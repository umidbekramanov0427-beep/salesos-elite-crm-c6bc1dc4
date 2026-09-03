"""Port of the 9 AmoCRM route files, built on the "client core"
(app/amocrm_client.py) and sync engine (app/amocrm_sync.py):

- integrations.amocrm.connect.ts   -> GET  /integrations/amocrm/connect
- integrations.amocrm.callback.ts  -> GET  /integrations/amocrm/callback
- integrations.amocrm.sync.ts      -> POST /integrations/amocrm/sync
- integrations.amocrm.sync-all.ts  -> POST /integrations/amocrm/sync-all
- integrations.amocrm.webhook.ts   -> POST /integrations/amocrm/webhook
- admin.amocrm-catalog.ts          -> GET  /admin/amocrm-catalog
- admin.amocrm-disconnect.ts       -> POST /admin/amocrm-disconnect
- admin.amocrm-import-settings.ts  -> POST /admin/amocrm-import-settings
- dashboard.amocrm-tasks.ts        -> GET  /dashboard/amocrm-tasks
"""

from __future__ import annotations

import re
import uuid
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from pydantic import BaseModel

from app.amocrm_client import (
    build_authorize_url,
    debug_amo_app_credentials,
    debug_amo_call_notes,
    exchange_code_for_tokens,
    get_connection,
    set_amo_app_credentials_direct,
    subscribe_amo_webhooks,
)
from app.amocrm_sync import (
    disconnect_amo_crm,
    fetch_amo_catalog,
    fetch_open_task_stats,
    save_amo_import_settings,
    sync_leads_from_amo,
    upsert_single_amo_lead,
)
from app.auth import (
    AuthedAdmin,
    get_request_user_id,
    get_user_id_from_token,
    require_cron_secret_dep,
    require_super_admin,
    require_super_admin_for_user,
)
from app.db import get_supabase_admin

router = APIRouter()


@router.get("/integrations/amocrm/connect")
async def amocrm_connect(request: Request) -> Response:
    """A plain browser navigation (the "Connect" link) can't carry an
    Authorization header, so the caller's access token is passed as a
    query param instead. The organization it resolves to is encoded into
    the OAuth `state` param, which AmoCRM echoes back verbatim to the
    callback."""
    token = request.query_params.get("token")
    user_id = await get_user_id_from_token(token) if token else None
    admin: AuthedAdmin | None = await require_super_admin_for_user(user_id) if user_id else None
    if not admin:
        return Response(content="Unauthorized", status_code=401)

    if request.query_params.get("debug") == "1":
        try:
            set_client_id = request.query_params.get("setClientId")
            set_client_secret = request.query_params.get("setClientSecret")
            if set_client_id and set_client_secret:
                # Writes with the service role, bypassing RLS and the
                # browser's JS bundle entirely.
                await set_amo_app_credentials_direct(admin.organization_id, set_client_id, set_client_secret)
            info = (
                await debug_amo_call_notes(admin.organization_id)
                if request.query_params.get("calls") == "1"
                else await debug_amo_app_credentials(admin.organization_id)
            )
            import json as _json

            return Response(content=_json.dumps(info, indent=2), media_type="application/json; charset=utf-8")
        except Exception as err:
            import json as _json

            return Response(
                content=_json.dumps({"error": str(err)}, indent=2),
                status_code=500,
                media_type="application/json; charset=utf-8",
            )

    state = f"{admin.organization_id}.{uuid.uuid4()}"
    try:
        authorize_url = await build_authorize_url(state, admin.organization_id)
        return Response(status_code=302, headers={"location": authorize_url})
    except Exception as err:
        return Response(content=str(err) or "AmoCRM is not configured.", status_code=500)


@router.get("/integrations/amocrm/callback")
async def amocrm_callback(request: Request) -> Response:
    code = request.query_params.get("code")
    # AmoCRM sends the account's subdomain back as `referer`.
    referer = request.query_params.get("referer")
    # Echoed back verbatim from the state we sent -- see connect above.
    state = request.query_params.get("state")
    organization_id = state.split(".")[0] if state else None

    if not code or not referer or not organization_id:
        return Response(
            content="AmoCRM did not send a code/referer/state. Open this page again from the AmoCRM integration screen.",
            status_code=400,
        )

    admin = get_supabase_admin()
    try:
        from datetime import datetime, timedelta, timezone

        tokens = await exchange_code_for_tokens(code, referer, organization_id)
        expires_at = (datetime.now(timezone.utc) + timedelta(seconds=tokens["expires_in"])).isoformat()

        admin.table("amocrm_connection").upsert(
            {
                "organization_id": organization_id,
                "subdomain": referer,
                "access_token": tokens["access_token"],
                "refresh_token": tokens["refresh_token"],
                "token_expires_at": expires_at,
                "connected_at": datetime.now(timezone.utc).isoformat(),
                "last_sync_error": None,
            }
        ).execute()

        # Read-modify-write, not a blind overwrite: config also carries this
        # org's own client_id/client_secret, which a plain update would
        # silently wipe.
        existing_settings = (
            admin.table("integration_settings")
            .select("config")
            .eq("organization_id", organization_id)
            .eq("key", "amocrm")
            .maybe_single()
            .execute()
            .data
        )
        current_config = (existing_settings or {}).get("config") or {}
        admin.table("integration_settings").update(
            {"enabled": True, "config": {**current_config, "subdomain": referer}}
        ).eq("organization_id", organization_id).eq("key", "amocrm").execute()

        # Best-effort: registers our endpoint with AmoCRM's own webhook
        # subscription API. Never block the connection on this.
        try:
            await subscribe_amo_webhooks(organization_id)
        except Exception as err:
            print(f"AmoCRM webhook subscribe failed: {err}")
    except Exception as err:
        return Response(content=f"AmoCRM connection failed: {err}", status_code=500)

    return Response(status_code=302, headers={"location": "/integrations?amocrm=connected"})


@router.post("/integrations/amocrm/sync")
async def amocrm_sync(authorization: str | None = Header(default=None)):
    """syncLeadsFromAmo already catches its own errors and always resolves
    to a {synced, error?} object, but require_super_admin (or an infra-
    level failure) throwing here would otherwise escape as an unhandled
    500 -- guarantee a JSON body no matter what goes wrong."""
    try:
        admin = await require_super_admin(authorization)
        if not admin:
            raise HTTPException(status_code=403, detail="Only admins can trigger a sync.")
        result = await sync_leads_from_amo(admin.organization_id)
        if result.get("error"):
            raise HTTPException(status_code=500, detail=result)
        return result
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail={"synced": 0, "error": str(err) or "Unknown sync error"}) from err


@router.post("/integrations/amocrm/sync-all", dependencies=[Depends(require_cron_secret_dep)])
async def amocrm_sync_all():
    """Called on a schedule, not by a browser -- syncs every organization
    that has an AmoCRM connection, one at a time so one org's failure
    can't take down the rest."""
    admin = get_supabase_admin()
    connections = admin.table("amocrm_connection").select("organization_id").execute().data or []

    results = []
    for conn in connections:
        try:
            result = await sync_leads_from_amo(conn["organization_id"])
            results.append({"organizationId": conn["organization_id"], **result})
        except Exception as err:
            results.append({"organizationId": conn["organization_id"], "error": str(err)})

    return {"organizations": len(results), "results": results}


# AmoCRM posts form-encoded fields like leads[add][0][id], leads[update][0][name] ...
_FIELD_PATTERN = re.compile(
    r"^leads\[(?:add|update)\]\[(\d+)\]\[(id|name|price|status_id|responsible_user_id|pipeline_id)\]$"
)

# Calls and tasks (and any lead field the classic webhook doesn't itemize)
# aren't in the payload at all -- piggyback a full incremental resync so
# those catch up immediately too, throttled to avoid hammering the AmoCRM
# API when a busy account fires many webhooks back-to-back.
_QUICK_RESYNC_MIN_GAP_MS = 30_000


def _verifies_connected_account(form: dict[str, Any], subdomain: str) -> bool:
    """AmoCRM's classic webhook only tells us about lead field changes
    (this endpoint's org routing comes from a caller-supplied ?org= query
    param, not from anything AmoCRM signs), so a stranger who guesses an
    organization_id could otherwise post fake lead data into another
    company's account. Every webhook payload carries account[subdomain]
    -- reject anything that doesn't match the org's own connected AmoCRM
    account before touching data."""
    posted = form.get("account[subdomain]")
    return isinstance(posted, str) and posted.lower() == subdomain.lower()


@router.post("/integrations/amocrm/webhook")
async def amocrm_webhook(request: Request) -> Response:
    """AmoCRM expects a fast 200 regardless of outcome, or it retries
    aggressively. The URL AmoCRM posts to must include ?org=<id>."""
    import asyncio
    from datetime import datetime, timezone

    try:
        organization_id = request.query_params.get("org")
        if not organization_id:
            return Response(content="ok", status_code=200)
        conn = await get_connection(organization_id)
        if not conn:
            return Response(content="ok", status_code=200)

        form_data = await request.form()
        form = dict(form_data)
        if not _verifies_connected_account(form, conn.subdomain):
            print(f"AmoCRM webhook: account mismatch for org {organization_id} (expected {conn.subdomain})")
            return Response(content="ok", status_code=200)

        by_index: dict[str, dict[str, str]] = {}
        for key, value in form_data.multi_items():
            match = _FIELD_PATTERN.match(key)
            if not match:
                continue
            index, field = match.group(1), match.group(2)
            entry = by_index.setdefault(index, {})
            entry[field] = str(value)

        for entry in by_index.values():
            if not entry.get("id"):
                continue
            await upsert_single_amo_lead(
                organization_id,
                int(entry["id"]),
                entry.get("name"),
                float(entry["price"]) if entry.get("price") else None,
                int(entry["status_id"]) if entry.get("status_id") else None,
                int(entry["responsible_user_id"]) if entry.get("responsible_user_id") else None,
                int(entry["pipeline_id"]) if entry.get("pipeline_id") else None,
            )

        since_last_sync = (
            (datetime.now(timezone.utc) - datetime.fromisoformat(conn.last_synced_at)).total_seconds() * 1000
            if conn.last_synced_at
            else float("inf")
        )
        if since_last_sync > _QUICK_RESYNC_MIN_GAP_MS:

            async def _quick_resync() -> None:
                try:
                    await sync_leads_from_amo(organization_id)
                except Exception as err:
                    print(f"AmoCRM webhook: quick resync failed: {err}")

            asyncio.create_task(_quick_resync())
    except Exception as err:
        print(f"AmoCRM webhook error: {err}")
    return Response(content="ok", status_code=200)


@router.get("/admin/amocrm-catalog")
async def amocrm_catalog(authorization: str | None = Header(default=None)):
    admin = await require_super_admin(authorization)
    if not admin:
        raise HTTPException(status_code=403, detail="Unauthorized")
    try:
        return await fetch_amo_catalog(admin.organization_id)
    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err) or "Could not load AmoCRM catalog.") from err


@router.post("/admin/amocrm-disconnect")
async def amocrm_disconnect(authorization: str | None = Header(default=None)):
    admin = await require_super_admin(authorization)
    if not admin:
        raise HTTPException(status_code=403, detail="Unauthorized")
    try:
        await disconnect_amo_crm(admin.organization_id)
        return {"ok": True}
    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err) or "Could not disconnect.") from err


class ImportSettingsBody(BaseModel):
    pipelineIds: list[Any] | None = None
    userIds: list[Any] | None = None


def _to_number_array(value: list[Any] | None) -> list[int]:
    return [v for v in (value or []) if isinstance(v, (int, float)) and not isinstance(v, bool)]


@router.post("/admin/amocrm-import-settings")
async def amocrm_import_settings(body: ImportSettingsBody, authorization: str | None = Header(default=None)):
    admin = await require_super_admin(authorization)
    if not admin:
        raise HTTPException(status_code=403, detail="Unauthorized")
    pipeline_ids = _to_number_array(body.pipelineIds)
    user_ids = _to_number_array(body.userIds)
    try:
        await save_amo_import_settings(admin.organization_id, pipeline_ids, user_ids)
        return {"ok": True}
    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err) or "Could not save.") from err


async def _visible_owner_ids(org_id: str, caller_id: str, role: str) -> list[str] | None:
    """None = unrestricted (super_admin/platform_owner sees the whole org);
    a rop only ever gets their own subordinates' tasks, everyone else only
    their own -- same scoping rule applied everywhere else in the app."""
    if role in ("super_admin", "platform_owner"):
        return None
    admin = get_supabase_admin()
    if role == "rop":
        reports = (
            admin.table("profiles")
            .select("id")
            .eq("organization_id", org_id)
            .eq("manager_id", caller_id)
            .execute()
            .data
            or []
        )
        return [caller_id] + [r["id"] for r in reports]
    return [caller_id]


@router.get("/dashboard/amocrm-tasks")
async def dashboard_amocrm_tasks(request: Request, authorization: str | None = Header(default=None)):
    try:
        user_id = await get_request_user_id(authorization)
        if not user_id:
            raise HTTPException(status_code=401, detail="Not signed in.")

        admin = get_supabase_admin()
        caller = (
            admin.table("profiles")
            .select("organization_id, role")
            .eq("id", user_id)
            .maybe_single()
            .execute()
            .data
        )
        if not caller or not caller.get("organization_id"):
            raise HTTPException(status_code=401, detail="Not signed in.")

        funnel = request.query_params.get("funnel")
        owner_ids = await _visible_owner_ids(caller["organization_id"], user_id, caller["role"])
        return await fetch_open_task_stats(caller["organization_id"], funnel, owner_ids)
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail={"dueToday": 0, "overdue": 0, "error": str(err)}) from err
