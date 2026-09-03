"""Port of the bidirectional sync engine in src/lib/amocrm/client.server.ts
-- syncLeadsFromAmo and everything it calls. Built on top of the "client
core" in app/amocrm_client.py (OAuth/token lifecycle, amoFetch/
amoWriteFetch, retry handling).

This is the historically buggiest module in the whole project (see the
original file's own header comment) -- almost every non-obvious line
below documents a real production bug that was fixed there: stale
composite-key migrations, blind config overwrites that silently wiped
per-org credentials, pagination bugs that dropped entire sync batches on
one bad page, memory-limit kills from unbounded fetches, statement
timeouts from unchunked bulk upserts. Every one of those comments is
preserved here because the underlying reason still applies to this
Python port -- Supabase/Postgres is the same database, chunking limits
are the same, and the retry/backoff logic in amocrm_client.py mirrors the
original exactly.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any

from app.amocrm_client import (
    AMO_LOST_STATUS_ID,
    AMO_WON_STATUS_ID,
    AmoConnection,
    dedupe_by_key,
    describe_error,
    ensure_valid_token,
    amo_fetch,
    fetch_all_paged,
    fetch_all_users,
    fetch_pipelines,
    get_connection,
)
from app.db import get_supabase_admin

# Shared login password for every auto-provisioned sales rep account. Reps
# log in with their AmoCRM email as username; nobody picks this password
# individually, so it's a fixed, known value by design (per product spec).
SOTUV_MENEJERI_DEFAULT_PASSWORD = "12345678"

STAGE_COLOR_ROTATION = ["bg-primary", "bg-info", "bg-warning", "bg-mint-border"]

# Fetching every contact/company in the account was the dominant cost of a
# sync even though only the handful referenced by this run's leads is ever
# used -- fetch exactly those ids, chunked.
ENTITY_ID_CHUNK = 100

# A full-history call-notes pull is the single biggest unbounded cost in a
# sync. Recent call history is what Audio Analytics actually needs; cap
# the window and page count so this can never push a sync over a memory
# limit. 365 days (not 30) since an account's real call history often
# predates when this integration was even connected.
CALL_NOTES_LOOKBACK_DAYS = 365
CALL_NOTES_MAX_PAGES = 20  # ~5k notes at limit=250

# Same "don't pull a whole account's history into one request" concern --
# caps the pull so a huge open-task backlog can't blow past memory/time
# limits.
TASKS_MAX_PAGES = 20  # ~5k open tasks at limit=250

# How long a sync is allowed to hold the lock before a later run treats it
# as abandoned (a crashed/killed worker never clears the flag otherwise).
SYNC_LOCK_STALE_MS = 10 * 60 * 1000


def _pipeline_status_key(pipeline_id: int, status_id: int) -> str:
    return f"{pipeline_id}:{status_id}"


def _is_final_stage(s: dict[str, Any]) -> bool:
    return bool(s.get("is_won")) or bool(s.get("is_lost"))


async def _default_stage_id(organization_id: str) -> str | None:
    admin = get_supabase_admin()
    row = (
        admin.table("pipeline_stages")
        .select("id")
        .eq("organization_id", organization_id)
        .eq("key", "new")
        .maybe_single()
        .execute()
        .data
    )
    return (row or {}).get("id")


async def _fetch_loss_reasons(conn: AmoConnection) -> dict[int, str]:
    """AmoCRM's account-wide loss-reasons catalog, fetched once per sync
    and looked up by id when building lead rows."""
    data = await amo_fetch(conn, "/api/v4/leads/loss_reasons?limit=250")
    reasons = ((data or {}).get("_embedded") or {}).get("loss_reasons") or []
    return {r["id"]: r["name"] for r in reasons}


def _amo_tag_names(lead: dict[str, Any]) -> list[str]:
    tags = ((lead.get("_embedded") or {}).get("tags")) or []
    return [t["name"] for t in tags if t.get("name")]


def _amo_main_contact_id(lead: dict[str, Any]) -> int | None:
    """First linked contact (preferring the one marked main), if any."""
    contacts = ((lead.get("_embedded") or {}).get("contacts")) or []
    main = next((c for c in contacts if c.get("is_main")), None)
    if main:
        return main["id"]
    return contacts[0]["id"] if contacts else None


def _amo_main_company_id(lead: dict[str, Any]) -> int | None:
    companies = ((lead.get("_embedded") or {}).get("companies")) or []
    return companies[0]["id"] if companies else None


def _custom_field(entity: dict[str, Any], code: str) -> str | None:
    fields = entity.get("custom_fields_values") or []
    field = next((f for f in fields if f.get("field_code") == code), None)
    if not field:
        return None
    values = field.get("values") or []
    return values[0].get("value") if values else None


async def _fetch_entities_by_ids(conn: AmoConnection, entity: str, ids: list[int]) -> dict[int, dict[str, Any]]:
    result: dict[int, dict[str, Any]] = {}
    chunks = [ids[i : i + ENTITY_ID_CHUNK] for i in range(0, len(ids), ENTITY_ID_CHUNK)]
    from app.amocrm_client import PAGE_FETCH_CONCURRENCY

    for i in range(0, len(chunks), PAGE_FETCH_CONCURRENCY):
        batch = chunks[i : i + PAGE_FETCH_CONCURRENCY]

        async def _fetch_chunk(chunk: list[int]) -> list[dict[str, Any]]:
            id_params = "&".join(f"filter[id][]={cid}" for cid in chunk)
            data = await amo_fetch(conn, f"/api/v4/{entity}?limit=250&{id_params}")
            return ((data or {}).get("_embedded") or {}).get(entity) or []

        results = await asyncio.gather(*(_fetch_chunk(c) for c in batch))
        for items in results:
            for item in items:
                result[item["id"]] = item
    return result


class _PipelineStageSync:
    def __init__(self, stage_by_status_id: dict[str, str], pipeline_name_by_id: dict[int, str]):
        self.stage_by_status_id = stage_by_status_id
        self.pipeline_name_by_id = pipeline_name_by_id


async def _sync_pipeline_stages(organization_id: str, conn: AmoConnection) -> _PipelineStageSync:
    """Mirrors AmoCRM's real pipeline/status structure into pipeline_stages,
    one row per (organization, amocrm_pipeline_id, amocrm_status_id) --
    additive, so stages created by hand in Settings (no amocrm_status_id)
    are left untouched."""
    admin = get_supabase_admin()
    all_pipelines = await fetch_pipelines(conn)
    pipelines = (
        [p for p in all_pipelines if p["id"] in conn.enabled_pipeline_ids]
        if conn.enabled_pipeline_ids
        else all_pipelines
    )
    pipeline_name_by_id = {p["id"]: (p.get("name") or "").strip() or "Direct Sales" for p in pipelines}

    rows: list[dict[str, Any]] = []
    index = 0
    for pipeline in pipelines:
        for status in ((pipeline.get("_embedded") or {}).get("statuses")) or []:
            is_won = status["id"] == AMO_WON_STATUS_ID
            is_lost = status["id"] == AMO_LOST_STATUS_ID
            rows.append(
                {
                    "organization_id": organization_id,
                    "amocrm_pipeline_id": pipeline["id"],
                    "amocrm_status_id": status["id"],
                    # AmoCRM reuses status ids 142/143 in *every* pipeline --
                    # the key must be scoped per pipeline too.
                    "key": f"amo-{pipeline['id']}-{status['id']}",
                    "name": status["name"],
                    "pipeline_name": pipeline_name_by_id.get(pipeline["id"], "Direct Sales"),
                    "position": status.get("sort", index),
                    "color": status.get("color")
                    or ("bg-success" if is_won else "bg-destructive" if is_lost else STAGE_COLOR_ROTATION[index % len(STAGE_COLOR_ROTATION)]),
                    "probability": 100 if is_won else 0 if is_lost else min(90, 20 + index * 15),
                    "is_won": is_won,
                    "is_lost": is_lost,
                }
            )
            index += 1
    if not rows:
        return _PipelineStageSync({}, pipeline_name_by_id)

    STAGE_UPSERT_CHUNK = 100
    deduped_rows = dedupe_by_key(rows, lambda r: f"{r['amocrm_pipeline_id']}:{r['amocrm_status_id']}")
    stage_by_status_id: dict[str, str] = {}
    for i in range(0, len(deduped_rows), STAGE_UPSERT_CHUNK):
        chunk = deduped_rows[i : i + STAGE_UPSERT_CHUNK]
        result = (
            admin.table("pipeline_stages")
            .upsert(chunk, on_conflict="organization_id,amocrm_pipeline_id,amocrm_status_id")
            .execute()
        )
        for row in result.data or []:
            if row.get("amocrm_pipeline_id") is not None and row.get("amocrm_status_id") is not None:
                stage_by_status_id[_pipeline_status_key(row["amocrm_pipeline_id"], row["amocrm_status_id"])] = row["id"]
    return _PipelineStageSync(stage_by_status_id, pipeline_name_by_id)


async def _sync_user_mapping(organization_id: str, conn: AmoConnection) -> dict[int, str]:
    """Matches AmoCRM users to existing profiles by email, auto-provisioning
    a sotuv_menejeri account for any AmoCRM user with no matching profile
    yet, returns amoUserId -> our profile id."""
    admin = get_supabase_admin()
    mapping: dict[int, str] = {}

    users = await fetch_all_users(conn)
    profiles = (
        admin.table("profiles")
        .select("id, email, amocrm_user_id")
        .eq("organization_id", organization_id)
        .execute()
        .data
        or []
    )
    profile_by_email = {p["email"].lower(): p for p in profiles}

    usable_users = [
        u
        for u in users
        if u.get("email") and (not conn.enabled_user_ids or u["id"] in conn.enabled_user_ids)
    ]

    from app.amocrm_client import PAGE_FETCH_CONCURRENCY

    for i in range(0, len(usable_users), PAGE_FETCH_CONCURRENCY):
        batch = usable_users[i : i + PAGE_FETCH_CONCURRENCY]

        async def _map_one(amo_user: dict[str, Any]) -> None:
            email = amo_user["email"].lower()
            profile = profile_by_email.get(email)
            if not profile:
                try:
                    created = admin.auth.admin.create_user(
                        {
                            "email": amo_user["email"],
                            "password": SOTUV_MENEJERI_DEFAULT_PASSWORD,
                            "email_confirm": True,
                            "user_metadata": {
                                "full_name": (amo_user.get("name") or "").strip() or amo_user["email"],
                                "role": "sotuv_menejeri",
                                "organization_id": organization_id,
                            },
                        }
                    )
                except Exception as err:
                    print(f"[amocrm sync] Could not auto-provision rep account for {amo_user['email']}: {err}")
                    return
                if not created.user:
                    print(f"[amocrm sync] Could not auto-provision rep account for {amo_user['email']}: unknown error")
                    return
                profile = {"id": created.user.id, "email": amo_user["email"], "amocrm_user_id": None}
                profile_by_email[email] = profile
            mapping[amo_user["id"]] = profile["id"]
            if profile.get("amocrm_user_id") != amo_user["id"]:
                admin.table("profiles").update({"amocrm_user_id": amo_user["id"]}).eq("id", profile["id"]).execute()

        await asyncio.gather(*(_map_one(u) for u in batch))

    return mapping


async def _fetch_call_notes(conn: AmoConnection) -> list[dict[str, Any]]:
    since_unix = int(datetime.now(timezone.utc).timestamp()) - CALL_NOTES_LOOKBACK_DAYS * 86400
    notes = await fetch_all_paged(
        conn,
        lambda page: (
            f"/api/v4/leads/notes?filter[note_type][]=call_in&filter[note_type][]=call_out"
            f"&filter[created_at][from]={since_unix}&order[created_at]=desc&limit=250&page={page}"
        ),
        lambda data: ((data or {}).get("_embedded") or {}).get("notes") or [],
        CALL_NOTES_MAX_PAGES,
    )
    return list({n["id"]: n for n in notes}.values())


class _NotificationRecipients:
    def __init__(self, super_admin_ids: list[str], manager_id_by_profile_id: dict[str, str | None], name_by_profile_id: dict[str, str]):
        self.super_admin_ids = super_admin_ids
        self.manager_id_by_profile_id = manager_id_by_profile_id
        self.name_by_profile_id = name_by_profile_id


async def _load_notification_recipients(organization_id: str) -> _NotificationRecipients:
    admin = get_supabase_admin()
    profiles = (
        admin.table("profiles")
        .select("id, role, manager_id, full_name")
        .eq("organization_id", organization_id)
        .execute()
        .data
        or []
    )
    super_admin_ids = [p["id"] for p in profiles if p["role"] in ("super_admin", "platform_owner")]
    manager_id_by_profile_id = {p["id"]: p.get("manager_id") for p in profiles}
    name_by_profile_id = {p["id"]: p["full_name"] for p in profiles}
    return _NotificationRecipients(super_admin_ids, manager_id_by_profile_id, name_by_profile_id)


def _recipients_for_owner(recipients: _NotificationRecipients, owner_id: str | None) -> list[str]:
    ids = set(recipients.super_admin_ids)
    if owner_id:
        ids.add(owner_id)
        manager_id = recipients.manager_id_by_profile_id.get(owner_id)
        if manager_id:
            ids.add(manager_id)
    return list(ids)


async def _insert_amo_notifications(
    organization_id: str, recipients: _NotificationRecipients, drafts: list[dict[str, Any]]
) -> None:
    """Best-effort by design: a bug here should never take down the actual
    lead sync that already succeeded."""
    if not drafts:
        return
    admin = get_supabase_admin()
    rows = [
        {
            "organization_id": organization_id,
            "user_id": user_id,
            "type": d["type"],
            "title": d["title"],
            "body": d["body"],
            "link": d["link"],
        }
        for d in drafts
        for user_id in _recipients_for_owner(recipients, d.get("ownerId"))
    ]
    NOTIF_CHUNK = 200
    for i in range(0, len(rows), NOTIF_CHUNK):
        chunk = rows[i : i + NOTIF_CHUNK]
        admin.table("notifications").insert(chunk).execute()


async def _load_stage_meta(organization_id: str) -> dict[str, dict[str, Any]]:
    admin = get_supabase_admin()
    rows = (
        admin.table("pipeline_stages")
        .select("id, name, is_won, is_lost")
        .eq("organization_id", organization_id)
        .execute()
        .data
        or []
    )
    return {r["id"]: {"name": r["name"], "isWon": r["is_won"], "isLost": r["is_lost"]} for r in rows}


def _lead_row_unchanged(existing: dict[str, Any], candidate: dict[str, Any]) -> bool:
    import json as _json

    return (
        existing["name"] == candidate["name"]
        and existing["company_name"] == candidate["company_name"]
        and existing["company_id"] == candidate["company_id"]
        and existing["contact_id"] == candidate["contact_id"]
        and existing["expected_revenue"] == candidate["expected_revenue"]
        and existing["budget"] == candidate["budget"]
        and existing["funnel"] == candidate["funnel"]
        and existing["stage_id"] == candidate["stage_id"]
        and existing["owner_id"] == candidate["owner_id"]
        and existing["loss_reason"] == candidate["loss_reason"]
        and _json.dumps(existing.get("tags") or []) == _json.dumps(candidate.get("tags") or [])
    )


async def sync_leads_from_amo(organization_id: str) -> dict[str, Any]:
    """Pulls every lead from AmoCRM and upserts it into public.leads, keyed
    by (organization_id, amocrm_id)."""
    admin = get_supabase_admin()
    conn0 = await get_connection(organization_id)
    if not conn0:
        raise RuntimeError("AmoCRM is not connected yet.")

    # The 5-minute cron has no built-in overlap protection -- skip instead
    # of piling a second full sync on top of a still-running one.
    if (
        conn0.sync_in_progress
        and conn0.sync_started_at
        and (
            datetime.now(timezone.utc) - datetime.fromisoformat(conn0.sync_started_at)
        ).total_seconds()
        * 1000
        < SYNC_LOCK_STALE_MS
    ):
        return {"synced": 0, "skipped": True}

    conn = await ensure_valid_token(conn0)
    admin.table("amocrm_connection").update(
        {"sync_in_progress": True, "sync_started_at": datetime.now(timezone.utc).isoformat()}
    ).eq("organization_id", organization_id).execute()

    try:
        pipeline_sync, owner_by_amo_user_id, fallback_stage_id, loss_reason_by_id, notif_recipients, stage_meta_by_id = await asyncio.gather(
            _sync_pipeline_stages(organization_id, conn),
            _sync_user_mapping(organization_id, conn),
            _default_stage_id(organization_id),
            _fetch_loss_reasons_safe(conn),
            _load_notification_recipients(organization_id),
            _load_stage_meta(organization_id),
        )
        stage_by_status_id = pipeline_sync.stage_by_status_id
        pipeline_name_by_id = pipeline_sync.pipeline_name_by_id

        SYNC_OVERLAP_SECONDS = 600
        since_filter = ""
        if conn.last_synced_at:
            since_unix = int(datetime.fromisoformat(conn.last_synced_at).timestamp()) - SYNC_OVERLAP_SECONDS
            since_filter = f"&filter[updated_at][from]={since_unix}"

        LEADS_LOOP_TIME_BUDGET_MS = 150_000
        leads_loop_started_at = datetime.now(timezone.utc)
        backfill_paused = False

        total_synced = 0
        page = 1 if conn.last_synced_at else (conn.initial_sync_page or 0) + 1

        while True:
            if not conn.last_synced_at and (
                datetime.now(timezone.utc) - leads_loop_started_at
            ).total_seconds() * 1000 > LEADS_LOOP_TIME_BUDGET_MS:
                backfill_paused = True
                break

            try:
                page_data = await amo_fetch(
                    conn, f"/api/v4/leads?limit=250&page={page}&with=tags,contacts,companies{since_filter}"
                )
            except Exception as e:
                raise RuntimeError(f"[page {page} leads-fetch] {describe_error(e)}") from e
            page_leads = dedupe_by_key(((page_data or {}).get("_embedded") or {}).get("leads") or [], lambda l: str(l["id"]))
            if not page_leads:
                break

            syncable_leads = (
                [l for l in page_leads if l["pipeline_id"] in conn.enabled_pipeline_ids]
                if conn.enabled_pipeline_ids
                else page_leads
            )

            referenced_contact_ids: set[int] = set()
            referenced_company_ids: set[int] = set()
            for l in syncable_leads:
                cid = _amo_main_contact_id(l)
                coid = _amo_main_company_id(l)
                if cid:
                    referenced_contact_ids.add(cid)
                if coid:
                    referenced_company_ids.add(coid)

            contacts_by_id, companies_by_id = await asyncio.gather(
                _fetch_entities_by_ids(conn, "contacts", list(referenced_contact_ids)),
                _fetch_entities_by_ids(conn, "companies", list(referenced_company_ids)),
            )

            contact_id_map: dict[int, str] = {}
            if referenced_contact_ids:
                contact_rows = [
                    {
                        "organization_id": organization_id,
                        "amocrm_id": c["id"],
                        "full_name": (c.get("name") or "").strip()
                        or f"{c.get('first_name') or ''} {c.get('last_name') or ''}".strip()
                        or "—",
                        "phone": _custom_field(c, "PHONE"),
                        "email": _custom_field(c, "EMAIL"),
                    }
                    for cid in referenced_contact_ids
                    if (c := contacts_by_id.get(cid)) is not None
                ]
                if contact_rows:
                    try:
                        result = (
                            admin.table("contacts")
                            .upsert(
                                dedupe_by_key(contact_rows, lambda r: str(r["amocrm_id"])),
                                on_conflict="organization_id,amocrm_id",
                            )
                            .execute()
                        )
                    except Exception as e:
                        raise RuntimeError(f"[page {page} contacts] {describe_error(e)}") from e
                    for row in result.data or []:
                        if row.get("amocrm_id") is not None:
                            contact_id_map[row["amocrm_id"]] = row["id"]

            company_id_map: dict[int, str] = {}
            if referenced_company_ids:
                company_rows = [
                    {
                        "organization_id": organization_id,
                        "amocrm_id": c["id"],
                        "name": (c.get("name") or "").strip() or f"AmoCRM company #{c['id']}",
                    }
                    for coid in referenced_company_ids
                    if (c := companies_by_id.get(coid)) is not None
                ]
                if company_rows:
                    try:
                        result = (
                            admin.table("companies")
                            .upsert(
                                dedupe_by_key(company_rows, lambda r: str(r["amocrm_id"])),
                                on_conflict="organization_id,amocrm_id",
                            )
                            .execute()
                        )
                    except Exception as e:
                        raise RuntimeError(f"[page {page} companies] {describe_error(e)}") from e
                    for row in result.data or []:
                        if row.get("amocrm_id") is not None:
                            company_id_map[row["amocrm_id"]] = row["id"]

            rows: list[dict[str, Any]] = []
            for l in syncable_leads:
                contact_amo_id = _amo_main_contact_id(l)
                company_amo_id = _amo_main_company_id(l)
                company = companies_by_id.get(company_amo_id) if company_amo_id else None
                rows.append(
                    {
                        "organization_id": organization_id,
                        "amocrm_id": l["id"],
                        "name": (l.get("name") or "").strip() or f"AmoCRM lead #{l['id']}",
                        "company_name": (company.get("name") or "").strip() if company else "",
                        "company_id": company_id_map.get(company_amo_id) if company_amo_id else None,
                        "contact_id": contact_id_map.get(contact_amo_id) if contact_amo_id else None,
                        "source": "AmoCRM",
                        "created_at": datetime.fromtimestamp(l["created_at"], tz=timezone.utc).isoformat(),
                        "expected_revenue": l.get("price") or 0,
                        "budget": l.get("price") or 0,
                        "funnel": pipeline_name_by_id.get(l["pipeline_id"], "Direct Sales"),
                        "stage_id": stage_by_status_id.get(
                            _pipeline_status_key(l["pipeline_id"], l["status_id"])
                        )
                        or fallback_stage_id,
                        "owner_id": (
                            owner_by_amo_user_id.get(l["responsible_user_id"])
                            if l.get("responsible_user_id")
                            else None
                        ),
                        "loss_reason": (
                            loss_reason_by_id.get(l["loss_reason_id"])
                            if l.get("loss_reason_id") is not None
                            else None
                        ),
                        "priority": "Normal",
                        "tags": _amo_tag_names(l),
                    }
                )
            deduped_lead_rows = dedupe_by_key(rows, lambda r: str(r["amocrm_id"]))

            existing_lead_rows = (
                admin.table("leads")
                .select(
                    "id, amocrm_id, name, company_name, company_id, contact_id, expected_revenue, budget, funnel, stage_id, owner_id, loss_reason, tags"
                )
                .eq("organization_id", organization_id)
                .in_("amocrm_id", [r["amocrm_id"] for r in deduped_lead_rows])
                .execute()
                .data
                or []
            )
            existing_by_amo_id = {r["amocrm_id"]: r for r in existing_lead_rows}

            notif_drafts: list[dict[str, Any]] = []
            for r in deduped_lead_rows:
                existing = existing_by_amo_id.get(r["amocrm_id"])
                if not existing:
                    continue  # new leads are notified after the upsert below
                if existing["stage_id"] != r["stage_id"]:
                    old_stage = stage_meta_by_id.get(existing["stage_id"]) if existing["stage_id"] else None
                    new_stage = stage_meta_by_id.get(r["stage_id"]) if r["stage_id"] else None
                    notif_drafts.append(
                        {
                            "ownerId": r["owner_id"],
                            "type": "LeadWon" if new_stage and new_stage["isWon"] else "LeadLost" if new_stage and new_stage["isLost"] else "LeadStage",
                            "title": "Lid yutildi" if new_stage and new_stage["isWon"] else "Lid yo'qotildi" if new_stage and new_stage["isLost"] else "Lid bosqichi o'zgartirildi",
                            "body": f"{r['name']} · {(old_stage or {}).get('name', '?')} → {(new_stage or {}).get('name', '?')}",
                            "link": f"/crm/leads/{existing['id']}",
                        }
                    )
                if existing["owner_id"] != r["owner_id"]:
                    old_owner_name = notif_recipients.name_by_profile_id.get(existing["owner_id"], "—") if existing["owner_id"] else "—"
                    new_owner_name = notif_recipients.name_by_profile_id.get(r["owner_id"], "—") if r["owner_id"] else "—"
                    notif_drafts.append(
                        {
                            "ownerId": r["owner_id"],
                            "type": "LeadOwner",
                            "title": "Lid boshqa menejerga o'tkazildi",
                            "body": f"{r['name']} · {old_owner_name} → {new_owner_name}",
                            "link": f"/crm/leads/{existing['id']}",
                        }
                    )

            rows_to_upsert = [
                r for r in deduped_lead_rows if not (existing := existing_by_amo_id.get(r["amocrm_id"])) or not _lead_row_unchanged(existing, r)
            ]

            LEADS_UPSERT_CHUNK = 100
            upserted_id_by_amo_id: dict[int, str] = {}
            for i in range(0, len(rows_to_upsert), LEADS_UPSERT_CHUNK):
                chunk = rows_to_upsert[i : i + LEADS_UPSERT_CHUNK]
                if not chunk:
                    continue
                try:
                    result = admin.table("leads").upsert(chunk, on_conflict="organization_id,amocrm_id").execute()
                except Exception as e:
                    raise RuntimeError(f"[page {page} leads {i}-{i + len(chunk)}] {describe_error(e)}") from e
                for row in result.data or []:
                    if row.get("amocrm_id") is not None:
                        upserted_id_by_amo_id[row["amocrm_id"]] = row["id"]

            for r in deduped_lead_rows:
                if r["amocrm_id"] in existing_by_amo_id:
                    continue
                lead_id = upserted_id_by_amo_id.get(r["amocrm_id"])
                if not lead_id:
                    continue
                notif_drafts.append(
                    {
                        "ownerId": r["owner_id"],
                        "type": "LeadNew",
                        "title": "Yangi lid qo'shildi",
                        "body": f"{r['name']} · {r['company_name']}" if r["company_name"] else r["name"],
                        "link": f"/crm/leads/{lead_id}",
                    }
                )

            try:
                await _insert_amo_notifications(organization_id, notif_recipients, notif_drafts)
            except Exception:
                pass

            total_synced += len(syncable_leads)
            if len(page_leads) < 250:
                break
            page += 1

        if backfill_paused:
            admin.table("amocrm_connection").update(
                {"initial_sync_page": page - 1, "last_sync_error": None}
            ).eq("organization_id", organization_id).execute()
            return {"synced": total_synced}

        calls_synced = 0
        calls_sync_warning: str | None = None
        try:
            calls_synced = await sync_calls_from_amo(conn, notif_recipients)
        except Exception as err:
            calls_sync_warning = f"Calls: {describe_error(err)}"

        tasks_synced = 0
        tasks_sync_warning: str | None = None
        try:
            tasks_synced = await sync_tasks_from_amo(conn, owner_by_amo_user_id)
        except Exception as err:
            tasks_sync_warning = f"Tasks: {describe_error(err)}"
        sync_warning = "; ".join(w for w in (calls_sync_warning, tasks_sync_warning) if w) or None

        admin.table("amocrm_connection").update(
            {
                "last_synced_at": datetime.now(timezone.utc).isoformat(),
                "last_sync_error": sync_warning,
                "initial_sync_page": None,
            }
        ).eq("organization_id", organization_id).execute()

        # Read-modify-write: config also carries this org's own AmoCRM
        # client_id/client_secret -- a blind overwrite here would wipe them
        # out on every 5-minute sync cycle.
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
            {
                "config": {
                    **current_config,
                    "subdomain": conn.subdomain,
                    "last_synced_at": datetime.now(timezone.utc).isoformat(),
                    "lead_count": total_synced,
                }
            }
        ).eq("organization_id", organization_id).eq("key", "amocrm").execute()

        return {"synced": total_synced, "callsSynced": calls_synced, "tasksSynced": tasks_synced}
    except Exception as err:
        message = describe_error(err)
        admin.table("amocrm_connection").update({"last_sync_error": message}).eq(
            "organization_id", organization_id
        ).execute()
        return {"synced": 0, "error": message}
    finally:
        admin.table("amocrm_connection").update({"sync_in_progress": False}).eq(
            "organization_id", organization_id
        ).execute()


async def _fetch_loss_reasons_safe(conn: AmoConnection) -> dict[int, str]:
    """Best-effort: a lead's own loss_reason_id is still written even when
    this fails, just unresolved to a name until a later sync succeeds."""
    try:
        return await _fetch_loss_reasons(conn)
    except Exception as e:
        print(f"[amoCRM] [loss reasons] {describe_error(e)}")
        return {}


async def sync_calls_from_amo(conn: AmoConnection, notif_recipients: _NotificationRecipients) -> int:
    """Pulls call-type notes from AmoCRM and upserts them into
    public.amocrm_calls. Returns count synced."""
    admin = get_supabase_admin()
    notes = await _fetch_call_notes(conn)
    if not notes:
        return 0

    amo_lead_ids = list({n["entity_id"] for n in notes})
    lead_rows = (
        admin.table("leads")
        .select("id, amocrm_id, name, owner_id")
        .eq("organization_id", conn.organization_id)
        .in_("amocrm_id", amo_lead_ids)
        .execute()
        .data
        or []
    )
    lead_by_amo_id = {l["amocrm_id"]: l for l in lead_rows}

    rows = []
    for n in notes:
        duration = (n.get("params") or {}).get("duration") or 0
        linked_lead = lead_by_amo_id.get(n["entity_id"])
        rows.append(
            {
                "organization_id": conn.organization_id,
                "amocrm_note_id": n["id"],
                "lead_id": linked_lead["id"] if linked_lead else None,
                # Kept even when lead_id resolves to null so a later sync can
                # go back and fix this row once the lead exists.
                "amocrm_lead_entity_id": n["entity_id"],
                "direction": "in" if n["note_type"] == "call_in" else "out",
                "phone": (n.get("params") or {}).get("phone"),
                "duration_seconds": duration,
                "connected": duration > 0,
                "recording_url": (n.get("params") or {}).get("link"),
                "occurred_at": datetime.fromtimestamp(n["created_at"], tz=timezone.utc).isoformat(),
            }
        )
    deduped_call_rows = dedupe_by_key(rows, lambda r: str(r["amocrm_note_id"]))

    existing_call_rows = (
        admin.table("amocrm_calls")
        .select("amocrm_note_id")
        .eq("organization_id", conn.organization_id)
        .in_("amocrm_note_id", [r["amocrm_note_id"] for r in deduped_call_rows])
        .execute()
        .data
        or []
    )
    existing_note_ids = {r["amocrm_note_id"] for r in existing_call_rows}
    new_call_rows = [r for r in deduped_call_rows if r["amocrm_note_id"] not in existing_note_ids]

    CALLS_UPSERT_CHUNK = 200
    for i in range(0, len(deduped_call_rows), CALLS_UPSERT_CHUNK):
        chunk = deduped_call_rows[i : i + CALLS_UPSERT_CHUNK]
        try:
            admin.table("amocrm_calls").upsert(chunk, on_conflict="organization_id,amocrm_note_id").execute()
        except Exception as e:
            raise RuntimeError(f"[calls {i}-{i + len(chunk)}] {describe_error(e)}") from e

    try:
        lead_by_id = {l["id"]: l for l in lead_by_amo_id.values()}
        notif_drafts = [
            {
                "ownerId": (lead_by_id.get(r["lead_id"]) or {}).get("owner_id"),
                "type": "Call",
                "title": "Yangi qo'ng'iroq yozuvi",
                "body": (
                    f"{(lead_by_id.get(r['lead_id']) or {}).get('name', '—')} · "
                    f"{'Kiruvchi' if r['direction'] == 'in' else 'Chiquvchi'} qo'ng'iroq"
                    + (f" ({r['duration_seconds']}s)" if r["connected"] else " (javobsiz)")
                ),
                "link": f"/crm/leads/{r['lead_id']}",
            }
            for r in new_call_rows
            if r.get("lead_id")
        ]
        await _insert_amo_notifications(conn.organization_id, notif_recipients, notif_drafts)
    except Exception:
        pass

    await backfill_orphaned_call_leads(conn.organization_id)

    return len(rows)


async def backfill_orphaned_call_leads(organization_id: str) -> None:
    """Repairs calls inserted with lead_id null because their AmoCRM lead
    hadn't synced yet -- runs on every sync so a later-synced lead gets
    linked retroactively."""
    admin = get_supabase_admin()
    orphaned = (
        admin.table("amocrm_calls")
        .select("id, amocrm_lead_entity_id")
        .eq("organization_id", organization_id)
        .is_("lead_id", "null")
        .not_.is_("amocrm_lead_entity_id", "null")
        .limit(2000)
        .execute()
        .data
        or []
    )
    if not orphaned:
        return

    entity_ids = list({r["amocrm_lead_entity_id"] for r in orphaned if r.get("amocrm_lead_entity_id") is not None})
    lead_rows = (
        admin.table("leads")
        .select("id, amocrm_id")
        .eq("organization_id", organization_id)
        .in_("amocrm_id", entity_ids)
        .execute()
        .data
        or []
    )
    lead_id_by_amo_id = {l["amocrm_id"]: l["id"] for l in lead_rows}
    if not lead_id_by_amo_id:
        return

    ids_by_lead_id: dict[str, list[str]] = {}
    for r in orphaned:
        if r.get("amocrm_lead_entity_id") is None:
            continue
        lead_id = lead_id_by_amo_id.get(r["amocrm_lead_entity_id"])
        if not lead_id:
            continue
        ids_by_lead_id.setdefault(lead_id, []).append(r["id"])
    for lead_id, ids in ids_by_lead_id.items():
        admin.table("amocrm_calls").update({"lead_id": lead_id}).in_("id", ids).execute()


async def fetch_open_task_stats(
    organization_id: str, funnel: str | None = None, owner_ids: list[str] | None = None
) -> dict[str, int]:
    """Counts this org's open AmoCRM tasks into "due later today" vs.
    "already overdue", optionally scoped to a funnel and/or owners by
    cross-referencing each task's lead against the local leads table."""
    conn0 = await get_connection(organization_id)
    if not conn0:
        return {"dueToday": 0, "overdue": 0}
    conn = await ensure_valid_token(conn0)

    tasks = await fetch_all_paged(
        conn,
        lambda page: f"/api/v4/tasks?filter[is_completed]=0&limit=250&page={page}",
        lambda data: ((data or {}).get("_embedded") or {}).get("tasks") or [],
        TASKS_MAX_PAGES,
    )

    relevant = tasks
    if funnel or owner_ids:
        admin = get_supabase_admin()
        query = admin.table("leads").select("amocrm_id").eq("organization_id", organization_id)
        if funnel:
            query = query.eq("funnel", funnel)
        if owner_ids:
            query = query.in_("owner_id", owner_ids)
        lead_rows = query.execute().data or []
        allowed_amo_ids = {l["amocrm_id"] for l in lead_rows if l.get("amocrm_id") is not None}
        relevant = [t for t in tasks if t.get("entity_type") == "leads" and t["entity_id"] in allowed_amo_ids]

    now = datetime.now(timezone.utc).timestamp()
    end_of_today = datetime.now(timezone.utc).replace(hour=23, minute=59, second=59, microsecond=999000)
    end_of_today_unix = end_of_today.timestamp()

    due_today = 0
    overdue = 0
    for t in relevant:
        if t["complete_till"] < now:
            overdue += 1
        elif t["complete_till"] <= end_of_today_unix:
            due_today += 1
    return {"dueToday": due_today, "overdue": overdue}


async def sync_tasks_from_amo(conn: AmoConnection, owner_by_amo_user_id: dict[int, str]) -> int:
    """Pulls every AmoCRM task tied to a lead (open and completed) and
    upserts them into public.tasks. Returns count synced."""
    admin = get_supabase_admin()
    all_tasks = await fetch_all_paged(
        conn,
        lambda page: f"/api/v4/tasks?limit=250&page={page}",
        lambda data: ((data or {}).get("_embedded") or {}).get("tasks") or [],
        TASKS_MAX_PAGES,
    )
    lead_tasks = [t for t in all_tasks if t.get("entity_type") == "leads"]
    if not lead_tasks:
        return 0

    amo_lead_ids = list({t["entity_id"] for t in lead_tasks})
    lead_rows = (
        admin.table("leads")
        .select("id, amocrm_id")
        .eq("organization_id", conn.organization_id)
        .in_("amocrm_id", amo_lead_ids)
        .execute()
        .data
        or []
    )
    lead_id_by_amo_id = {l["amocrm_id"]: l["id"] for l in lead_rows}

    rows = [
        {
            "organization_id": conn.organization_id,
            "amocrm_task_id": t["id"],
            "lead_id": lead_id_by_amo_id.get(t["entity_id"]),
            "title": (t.get("text") or "").strip() or f"AmoCRM task #{t['id']}",
            "status": "Done" if t.get("is_completed") else "Todo",
            "assignee_id": (
                owner_by_amo_user_id.get(t["responsible_user_id"]) if t.get("responsible_user_id") else None
            ),
            "due_date": (
                datetime.fromtimestamp(t["complete_till"], tz=timezone.utc).isoformat()
                if t.get("complete_till")
                else None
            ),
        }
        for t in lead_tasks
    ]
    deduped_task_rows = dedupe_by_key(rows, lambda r: str(r["amocrm_task_id"]))

    TASKS_UPSERT_CHUNK = 200
    for i in range(0, len(deduped_task_rows), TASKS_UPSERT_CHUNK):
        chunk = deduped_task_rows[i : i + TASKS_UPSERT_CHUNK]
        try:
            admin.table("tasks").upsert(chunk, on_conflict="organization_id,amocrm_task_id").execute()
        except Exception as e:
            raise RuntimeError(f"[tasks {i}-{i + len(chunk)}] {describe_error(e)}") from e

    return len(deduped_task_rows)


async def resolve_stage_id(organization_id: str, status_id: int | None, pipeline_id: int | None = None) -> str | None:
    """Resolves a stage_id for a single AmoCRM status_id, falling back to
    the org's "new" stage."""
    if status_id is not None:
        admin = get_supabase_admin()
        query = (
            admin.table("pipeline_stages")
            .select("id")
            .eq("organization_id", organization_id)
            .eq("amocrm_status_id", status_id)
        )
        if pipeline_id is not None:
            query = query.eq("amocrm_pipeline_id", pipeline_id)
        rows = query.limit(1).execute().data or []
        if rows:
            return rows[0]["id"]
    return await _default_stage_id(organization_id)


async def resolve_owner_id(organization_id: str, amo_user_id: int | None) -> str | None:
    """Resolves an owner profile id for a single AmoCRM responsible_user_id,
    if that user was matched by email."""
    if amo_user_id is None:
        return None
    admin = get_supabase_admin()
    row = (
        admin.table("profiles")
        .select("id")
        .eq("organization_id", organization_id)
        .eq("amocrm_user_id", amo_user_id)
        .maybe_single()
        .execute()
        .data
    )
    return (row or {}).get("id")


async def upsert_single_amo_lead(
    organization_id: str,
    amo_lead_id: int,
    name: str | None,
    price: float | None,
    status_id: int | None,
    responsible_user_id: int | None,
    pipeline_id: int | None = None,
) -> None:
    """Upserts a single lead -- used by the webhook handler for near-real-
    time updates."""
    stage_id, owner_id = await asyncio.gather(
        resolve_stage_id(organization_id, status_id, pipeline_id),
        resolve_owner_id(organization_id, responsible_user_id),
    )
    admin = get_supabase_admin()
    admin.table("leads").upsert(
        {
            "organization_id": organization_id,
            "amocrm_id": amo_lead_id,
            "name": (name or "").strip() or f"AmoCRM lead #{amo_lead_id}",
            "company_name": "",
            "source": "AmoCRM",
            "expected_revenue": price or 0,
            "budget": price or 0,
            "stage_id": stage_id,
            "owner_id": owner_id,
            "priority": "Normal",
        },
        on_conflict="organization_id,amocrm_id",
    ).execute()


async def fetch_amo_catalog(organization_id: str) -> dict[str, Any]:
    """Live list of every AmoCRM pipeline/operator for the
    amocrm-import-settings admin page, plus the org's current selection."""
    conn0 = await get_connection(organization_id)
    if not conn0:
        raise RuntimeError("AmoCRM is not connected yet.")
    conn = await ensure_valid_token(conn0)

    admin = get_supabase_admin()
    pipelines, users = await asyncio.gather(fetch_pipelines(conn), fetch_all_users(conn))
    profiles = (
        admin.table("profiles").select("email").eq("organization_id", organization_id).execute().data or []
    )
    existing_emails = {p["email"].lower() for p in profiles}

    return {
        "subdomain": conn.subdomain,
        "pipelines": [{"id": p["id"], "name": p["name"], "is_main": bool(p.get("is_main"))} for p in pipelines],
        "operators": [
            {
                "id": u["id"],
                "name": (u.get("name") or "").strip() or u.get("email") or f"AmoCRM user #{u['id']}",
                "email": u.get("email"),
                "existingProfileEmail": u.get("email") if u.get("email") and u["email"].lower() in existing_emails else None,
            }
            for u in users
        ],
        "enabledPipelineIds": conn.enabled_pipeline_ids,
        "enabledUserIds": conn.enabled_user_ids,
    }


async def save_amo_import_settings(organization_id: str, enabled_pipeline_ids: list[int], enabled_user_ids: list[int]) -> None:
    """Saves which AmoCRM pipelines/operators sync_leads_from_amo should
    actually pull. Resets last_synced_at to null so the next sync is a
    full pull covering the newly-widened scope, instead of only picking up
    brand-new activity in it (syncLeadsFromAmo's since-filter would
    otherwise silently skip everything else in the newly-enabled scope)."""
    admin = get_supabase_admin()
    admin.table("amocrm_connection").update(
        {
            "enabled_pipeline_ids": enabled_pipeline_ids,
            "enabled_user_ids": enabled_user_ids,
            "last_synced_at": None,
        }
    ).eq("organization_id", organization_id).execute()


async def disconnect_amo_crm(organization_id: str) -> None:
    """Removes the org's AmoCRM connection (and its access/refresh tokens)
    and flips integration_settings back off."""
    admin = get_supabase_admin()
    admin.table("amocrm_connection").delete().eq("organization_id", organization_id).execute()
    admin.table("integration_settings").update({"enabled": False}).eq("organization_id", organization_id).eq(
        "key", "amocrm"
    ).execute()
