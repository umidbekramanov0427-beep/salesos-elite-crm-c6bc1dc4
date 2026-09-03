"""Partial port of src/lib/amocrm/client.server.ts -- the "client core" only:
OAuth token lifecycle, per-org credential resolution, the low-level
amoFetch/amoWriteFetch HTTP layer, webhook subscription, and the three
write/read helpers audio-analytics.analyze.ts needs (createAmoTask,
createAmoNote, hasHumanNoteSince).

NOT ported here -- deliberately left for a dedicated future session, per
PORT_STATUS.md: the bidirectional sync engine (syncLeadsFromAmo,
syncPipelineStages, syncUserMapping, syncCallsFromAmo, syncTasksFromAmo,
backfillOrphanedCallLeads, fetchOpenTaskStats, resolveStageId/
resolveOwnerId/upsertSingleAmoLead, fetchAmoCatalog,
saveAmoImportSettings, disconnectAmoCrm -- roughly 900 more lines in the
original) and the 9 route files built on top of it
(integrations.amocrm.connect/callback/sync/sync-all/webhook.ts,
admin.amocrm-catalog/-disconnect/-import-settings.ts,
dashboard.amocrm-tasks.ts). That is this project's largest, most
fought-over subsystem (see the original file's own header comment); this
module only covers what audio-analytics genuinely needs to run, ported
with the same care and the same inline reasoning as the original where it
applies here.
"""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlsplit

import httpx

from app.db import get_supabase_admin

# AmoCRM confirmed webhook settings this platform acts on -- leads (incl.
# notes/status/owner changes) and tasks. See client.server.ts's own
# comment: contacts/companies/customers/talks/messages are intentionally
# left out, nothing here parses those events.
AMO_WEBHOOK_SETTINGS = [
    "add_lead",
    "update_lead",
    "delete_lead",
    "restore_lead",
    "status_lead",
    "responsible_lead",
    "note_lead",
    "add_task",
    "update_task",
    "delete_task",
    "responsible_task",
]

# Same rate-limit/5xx retry budgets as the original (amoFetch's
# RATE_LIMIT_MAX_RETRIES / SERVER_ERROR_MAX_RETRIES).
_RATE_LIMIT_MAX_RETRIES = 6
_SERVER_ERROR_MAX_RETRIES = 3


def _require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing environment variable: {name}. Add it in Settings -> Secrets.")
    return value


def get_amo_redirect_uri() -> str:
    return _require_env("AMOCRM_REDIRECT_URI")


async def _get_amo_app_credentials(organization_id: str) -> tuple[str, str]:
    """Per-org client_id/client_secret (integration_settings.config), falling
    back to the platform-wide AMOCRM_CLIENT_ID/AMOCRM_CLIENT_SECRET env vars
    -- same fallback rule as the original, only evaluated when actually
    needed."""
    admin = get_supabase_admin()
    row = (
        admin.table("integration_settings")
        .select("config")
        .eq("organization_id", organization_id)
        .eq("key", "amocrm")
        .maybe_single()
        .execute()
        .data
    )
    config = (row or {}).get("config") or {}
    client_id = (config.get("client_id") or "").strip() or _require_env("AMOCRM_CLIENT_ID")
    client_secret = (config.get("client_secret") or "").strip() or _require_env(
        "AMOCRM_CLIENT_SECRET"
    )
    return client_id, client_secret


class AmoConnection:
    def __init__(self, row: dict[str, Any]):
        self.organization_id: str = row["organization_id"]
        self.subdomain: str = row["subdomain"]
        self.access_token: str = row["access_token"]
        self.refresh_token: str = row["refresh_token"]
        self.token_expires_at: str = row["token_expires_at"]
        self.enabled_pipeline_ids: list[int] | None = row.get("enabled_pipeline_ids")
        self.enabled_user_ids: list[int] | None = row.get("enabled_user_ids")


async def get_connection(organization_id: str) -> AmoConnection | None:
    admin = get_supabase_admin()
    row = (
        admin.table("amocrm_connection")
        .select("*")
        .eq("organization_id", organization_id)
        .maybe_single()
        .execute()
        .data
    )
    return AmoConnection(row) if row else None


async def _token_request(subdomain: str, body: dict[str, str]) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.post(f"https://{subdomain}/oauth2/access_token", json=body)
    if res.status_code >= 400:
        raise RuntimeError(f"AmoCRM token request failed ({res.status_code}): {res.text}")
    return res.json()


async def _refresh_tokens(conn: AmoConnection) -> AmoConnection:
    """Mutates conn in place, same as the original -- any other in-flight
    reference to this connection object picks up the refreshed token too."""
    client_id, client_secret = await _get_amo_app_credentials(conn.organization_id)
    tokens = await _token_request(
        conn.subdomain,
        {
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "refresh_token",
            "refresh_token": conn.refresh_token,
            "redirect_uri": get_amo_redirect_uri(),
        },
    )
    expires_at = (
        datetime.now(timezone.utc) + timedelta(seconds=tokens["expires_in"])
    ).isoformat()
    admin = get_supabase_admin()
    admin.table("amocrm_connection").update(
        {
            "access_token": tokens["access_token"],
            "refresh_token": tokens["refresh_token"],
            "token_expires_at": expires_at,
        }
    ).eq("organization_id", conn.organization_id).execute()
    conn.access_token = tokens["access_token"]
    conn.refresh_token = tokens["refresh_token"]
    conn.token_expires_at = expires_at

    # Tokens refresh roughly once a day -- piggyback the webhook
    # (re)subscription here so an already-connected org stays subscribed
    # without needing to reconnect. Fire-and-forget: never let a webhook
    # API hiccup delay or fail the token refresh itself.
    async def _resubscribe() -> None:
        try:
            await subscribe_amo_webhooks_internal(conn)
        except Exception as err:
            print(f"AmoCRM webhook subscribe failed: {err}")

    asyncio.create_task(_resubscribe())
    return conn


async def _ensure_valid_token(conn: AmoConnection) -> AmoConnection:
    expires_at = datetime.fromisoformat(conn.token_expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    expires_in = (expires_at - datetime.now(timezone.utc)).total_seconds()
    if expires_in > 60:
        return conn
    return await _refresh_tokens(conn)


def _parse_amo_response(text: str, path: str) -> Any:
    """AmoCRM occasionally serializes note text with raw, unescaped control
    characters -- invalid JSON. Strip control chars and retry once, same
    recovery as the original's parseAmoResponse."""
    import json

    try:
        return json.loads(text)
    except json.JSONDecodeError as err:
        try:
            cleaned = "".join(" " if ord(c) <= 31 else c for c in text)
            return json.loads(cleaned)
        except json.JSONDecodeError:
            raise RuntimeError(f"AmoCRM returned invalid JSON on {path}: {err}") from err


async def _amo_fetch(conn: AmoConnection, path: str, attempt: int = 1, tried_refresh: bool = False) -> Any:
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.get(
                f"https://{conn.subdomain}{path}",
                headers={"authorization": f"Bearer {conn.access_token}"},
            )
    except httpx.HTTPError:
        if attempt <= _SERVER_ERROR_MAX_RETRIES:
            await asyncio.sleep(attempt)
            return await _amo_fetch(conn, path, attempt + 1, tried_refresh)
        raise

    if res.status_code == 429 and attempt <= _RATE_LIMIT_MAX_RETRIES:
        retry_after = res.headers.get("retry-after")
        delay = float(retry_after) if retry_after and retry_after.isdigit() else attempt
        await asyncio.sleep(delay)
        return await _amo_fetch(conn, path, attempt + 1, tried_refresh)
    if res.status_code >= 500 and attempt <= _SERVER_ERROR_MAX_RETRIES:
        await asyncio.sleep(attempt)
        return await _amo_fetch(conn, path, attempt + 1, tried_refresh)
    if res.status_code == 401 and not tried_refresh:
        await _refresh_tokens(conn)
        return await _amo_fetch(conn, path, attempt, True)
    if res.status_code == 204:
        return None
    if res.status_code >= 400:
        raise RuntimeError(f"AmoCRM API error ({res.status_code}) on {path}: {res.text}")
    try:
        return _parse_amo_response(res.text, path)
    except RuntimeError:
        if attempt <= _SERVER_ERROR_MAX_RETRIES:
            await asyncio.sleep(attempt)
            return await _amo_fetch(conn, path, attempt + 1, tried_refresh)
        raise


async def _amo_write_fetch(conn: AmoConnection, path: str, method: str, body: Any) -> Any:
    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.request(
            method,
            f"https://{conn.subdomain}{path}",
            headers={"authorization": f"Bearer {conn.access_token}"},
            json=body,
        )
    if res.status_code >= 400:
        raise RuntimeError(f"AmoCRM API error ({res.status_code}) on {path}: {res.text}")
    return _parse_amo_response(res.text, path)


async def subscribe_amo_webhooks_internal(conn: AmoConnection) -> None:
    parsed = urlsplit(get_amo_redirect_uri())
    origin = f"{parsed.scheme}://{parsed.netloc}"
    destination = f"{origin}/integrations/amocrm/webhook?org={conn.organization_id}"
    await _amo_write_fetch(
        conn, "/api/v4/webhooks", "POST", {"destination": destination, "settings": AMO_WEBHOOK_SETTINGS}
    )


async def subscribe_amo_webhooks(organization_id: str) -> None:
    conn = await get_connection(organization_id)
    if not conn:
        return
    valid_conn = await _ensure_valid_token(conn)
    await subscribe_amo_webhooks_internal(valid_conn)


async def create_amo_task(
    organization_id: str,
    lead_amo_id: int,
    text: str,
    complete_till: int,
    responsible_amo_user_id: int | None,
) -> int | None:
    """Creates a task on an AmoCRM lead -- used to hand a call's AI-suggested
    next step to the responsible manager as a reminder inside AmoCRM."""
    conn = await get_connection(organization_id)
    if not conn:
        raise RuntimeError("AmoCRM ulanmagan.")
    valid_conn = await _ensure_valid_token(conn)
    payload_item: dict[str, Any] = {
        "text": text,
        "complete_till": complete_till,
        "entity_id": lead_amo_id,
        "entity_type": "leads",
    }
    if responsible_amo_user_id is not None:
        payload_item["responsible_user_id"] = responsible_amo_user_id
    json_res = await _amo_write_fetch(valid_conn, "/api/v4/tasks", "POST", [payload_item])
    tasks = ((json_res or {}).get("_embedded") or {}).get("tasks") or []
    return tasks[0]["id"] if tasks else None


async def create_amo_note(organization_id: str, lead_amo_id: int, text: str) -> int | None:
    """Adds a plain text note to an AmoCRM lead -- used to log the AI's
    summary of a call when the rep didn't already write one up themselves
    (see has_human_note_since)."""
    conn = await get_connection(organization_id)
    if not conn:
        raise RuntimeError("AmoCRM ulanmagan.")
    valid_conn = await _ensure_valid_token(conn)
    payload = [{"note_type": "common", "params": {"text": text}}]
    json_res = await _amo_write_fetch(valid_conn, f"/api/v4/leads/{lead_amo_id}/notes", "POST", payload)
    notes = ((json_res or {}).get("_embedded") or {}).get("notes") or []
    return notes[0]["id"] if notes else None


async def has_human_note_since(organization_id: str, lead_amo_id: int, since_unix_seconds: int) -> bool:
    """Whether a lead already has a manually-written ("common") note created
    after the given moment. Any fetch failure is treated as "no human note
    found" (fails open toward the AI writing its own note)."""
    conn = await get_connection(organization_id)
    if not conn:
        return False
    try:
        valid_conn = await _ensure_valid_token(conn)
        json_res = await _amo_fetch(
            valid_conn,
            f"/api/v4/leads/{lead_amo_id}/notes?filter[note_type][]=common&order[created_at]=desc&limit=10",
        )
        notes = ((json_res or {}).get("_embedded") or {}).get("notes") or []
        return any(n.get("created_at", 0) >= since_unix_seconds for n in notes)
    except Exception:
        return False
