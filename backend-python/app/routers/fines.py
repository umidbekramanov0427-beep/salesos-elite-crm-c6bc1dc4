"""Port of src/routes/fines.compute.ts and fines.publish.ts.

fines.compute.ts checks each org's *configured* fine types against real CRM
state -- not an AI reading of call transcripts. The seeded "CRM bilan
ishlash bo'yicha jarimalar reglamenti" fine types are entirely about
lead/task/stage hygiene (an unworked new lead, an overdue task, a Lost lead
with no reason, an unanswered incoming call), all exact, checkable facts in
the database, so they're computed deterministically here. Matched by the
fine type's exact `name` against a fixed set of known rule keys; a fine
type whose name doesn't match any known rule is left alone (not computed,
no guessing).

Every check reads is_won/is_lost (already admin-overridable per org on the
"CRM natija bosqichlari" settings tab) and each pipeline's own stage
`position` ordering -- never a hardcoded stage name.

NOT automated (left for manual entry via "Jarima qo'shish"), same as the
original: "Sotuvdan keyin o'tkazilmagan lid" / "So'rovsiz lid olish"
(needs an ownership-change audit trail), "Noto'g'ri lid holati" (too
general), "CRM ga kiritilmagan tashrif" (needs an external record), and the
"noto'g'ri sabab" (vs. simply missing) nuance of the LOST rule.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Awaitable, Callable

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from app.auth import get_request_user_id, require_cron_secret_dep
from app.db import get_supabase_admin
from app.telegram_report import send_telegram_message

router = APIRouter()


def _tashkent_today() -> tuple[str, str, str]:
    tashkent_now = datetime.now(timezone.utc) + timedelta(hours=5)
    date_str = tashkent_now.strftime("%Y-%m-%d")
    start = datetime.fromisoformat(f"{date_str}T00:00:00+05:00")
    end = datetime.fromisoformat(f"{date_str}T23:59:59+05:00")
    return date_str, start.astimezone(timezone.utc).isoformat(), end.astimezone(timezone.utc).isoformat()


def _is_final_stage(s: dict[str, Any]) -> bool:
    won = s.get("counts_as_won_override")
    lost = s.get("counts_as_lost_override")
    return (won if won is not None else s.get("is_won")) or (
        lost if lost is not None else s.get("is_lost")
    )


def _is_lost_stage(s: dict[str, Any]) -> bool:
    override = s.get("counts_as_lost_override")
    return override if override is not None else s.get("is_lost")


async def _insert_if_new(
    organization_id: str, fine_type_id: str, profile_id: str, date_str: str, amount: float, reason: str
) -> bool:
    admin = get_supabase_admin()
    existing = (
        admin.table("fines")
        .select("id")
        .eq("organization_id", organization_id)
        .eq("profile_id", profile_id)
        .eq("fine_type_id", fine_type_id)
        .eq("occurred_on", date_str)
        .eq("source", "ai")
        .maybe_single()
        .execute()
        .data
    )
    if existing:
        return False
    try:
        admin.table("fines").insert(
            {
                "organization_id": organization_id,
                "profile_id": profile_id,
                "fine_type_id": fine_type_id,
                "amount": amount,
                "occurred_on": date_str,
                "reason": reason,
                "source": "ai",
            }
        ).execute()
        return True
    except Exception:
        return False


async def _check_unworked_new_leads(
    organization_id: str,
    fine_type: dict[str, Any],
    date_str: str,
    start_iso: str,
    end_iso: str,
    eligible_profile_ids: set[str] | None,
) -> int:
    admin = get_supabase_admin()
    leads = (
        admin.table("leads")
        .select("id, owner_id, stage_id, loss_reason, created_at, updated_at")
        .eq("organization_id", organization_id)
        .gte("created_at", start_iso)
        .lte("created_at", end_iso)
        .execute()
        .data
        or []
    )
    if not leads:
        return 0

    stages = (
        admin.table("pipeline_stages")
        .select(
            "id, pipeline_name, position, is_won, is_lost, counts_as_won_override, counts_as_lost_override"
        )
        .eq("organization_id", organization_id)
        .execute()
        .data
        or []
    )
    stages_by_id = {s["id"]: s for s in stages}

    first_stage_by_pipeline: dict[str, int] = {}
    for s in stages:
        if _is_final_stage(s):
            continue
        key = s.get("pipeline_name") or ""
        cur = first_stage_by_pipeline.get(key)
        if cur is None or s["position"] < cur:
            first_stage_by_pipeline[key] = s["position"]

    created = 0
    for lead in leads:
        if not lead.get("owner_id") or not lead.get("stage_id"):
            continue
        if eligible_profile_ids is not None and lead["owner_id"] not in eligible_profile_ids:
            continue
        stage = stages_by_id.get(lead["stage_id"])
        if not stage:
            continue
        first_pos = first_stage_by_pipeline.get(stage.get("pipeline_name") or "")
        if first_pos is None or stage["position"] != first_pos:
            continue
        if lead["updated_at"] != lead["created_at"]:
            continue
        ok = await _insert_if_new(
            organization_id,
            fine_type["id"],
            lead["owner_id"],
            date_str,
            fine_type.get("default_amount") or 0,
            "Yangi lid etapida kun oxirigacha ishlanmay qoldi.",
        )
        if ok:
            created += 1
    return created


async def _check_overdue_tasks(
    organization_id: str,
    fine_type: dict[str, Any],
    date_str: str,
    end_iso: str,
    eligible_profile_ids: set[str] | None,
) -> int:
    admin = get_supabase_admin()
    tasks = (
        admin.table("tasks")
        .select("id, assignee_id, due_date, status")
        .eq("organization_id", organization_id)
        .lte("due_date", end_iso)
        .neq("status", "Done")
        .execute()
        .data
        or []
    )
    if not tasks:
        return 0
    created = 0
    for t in tasks:
        if not t.get("assignee_id"):
            continue
        if eligible_profile_ids is not None and t["assignee_id"] not in eligible_profile_ids:
            continue
        ok = await _insert_if_new(
            organization_id,
            fine_type["id"],
            t["assignee_id"],
            date_str,
            fine_type.get("default_amount") or 0,
            "Muddati o'tgan, bajarilmagan vazifa.",
        )
        if ok:
            created += 1
    return created


async def _check_lost_without_reason(
    organization_id: str,
    fine_type: dict[str, Any],
    date_str: str,
    start_iso: str,
    end_iso: str,
    eligible_profile_ids: set[str] | None,
) -> int:
    admin = get_supabase_admin()
    leads = (
        admin.table("leads")
        .select("id, owner_id, stage_id, loss_reason, created_at, updated_at")
        .eq("organization_id", organization_id)
        .gte("updated_at", start_iso)
        .lte("updated_at", end_iso)
        .execute()
        .data
        or []
    )
    if not leads:
        return 0
    stages = (
        admin.table("pipeline_stages")
        .select("id, position, is_won, is_lost, counts_as_won_override, counts_as_lost_override")
        .eq("organization_id", organization_id)
        .execute()
        .data
        or []
    )
    lost_stage_ids = {s["id"] for s in stages if _is_lost_stage(s)}

    created = 0
    for lead in leads:
        if not lead.get("owner_id") or not lead.get("stage_id"):
            continue
        if eligible_profile_ids is not None and lead["owner_id"] not in eligible_profile_ids:
            continue
        if lead["stage_id"] not in lost_stage_ids:
            continue
        if lead.get("loss_reason") and lead["loss_reason"].strip():
            continue
        ok = await _insert_if_new(
            organization_id,
            fine_type["id"],
            lead["owner_id"],
            date_str,
            fine_type.get("default_amount") or 0,
            "Lid LOST etapiga sababsiz o'tkazildi.",
        )
        if ok:
            created += 1
    return created


async def _check_unanswered_incoming_calls(
    organization_id: str,
    fine_type: dict[str, Any],
    date_str: str,
    start_iso: str,
    end_iso: str,
    eligible_profile_ids: set[str] | None,
) -> int:
    admin = get_supabase_admin()
    calls = (
        admin.table("amocrm_calls")
        .select("id, lead_id, connected, direction")
        .eq("organization_id", organization_id)
        .eq("direction", "in")
        .eq("connected", False)
        .gte("occurred_at", start_iso)
        .lte("occurred_at", end_iso)
        .execute()
        .data
        or []
    )
    if not calls:
        return 0
    lead_ids = list({c["lead_id"] for c in calls if c.get("lead_id")})
    if not lead_ids:
        return 0
    leads = admin.table("leads").select("id, owner_id").in_("id", lead_ids).execute().data or []
    owner_by_lead = {l["id"]: l.get("owner_id") for l in leads}

    created = 0
    for call in calls:
        owner_id = owner_by_lead.get(call["lead_id"]) if call.get("lead_id") else None
        if not owner_id:
            continue
        if eligible_profile_ids is not None and owner_id not in eligible_profile_ids:
            continue
        ok = await _insert_if_new(
            organization_id,
            fine_type["id"],
            owner_id,
            date_str,
            fine_type.get("default_amount") or 0,
            "Kiruvchi qo'ng'iroqqa javob berilmadi.",
        )
        if ok:
            created += 1
    return created


_RuleCheck = Callable[
    [str, dict[str, Any], str, str, str, "set[str] | None"], Awaitable[int]
]

_RULE_CHECKS: dict[str, _RuleCheck] = {
    "Ishlanmagan yangi lid": _check_unworked_new_leads,
    "Bajarilmagan zadacha": lambda org, ft, d, s, e, elig: _check_overdue_tasks(org, ft, d, e, elig),
    "Noto'g'ri LOST": _check_lost_without_reason,
    "Javobsiz kiruvchi aloqa": _check_unanswered_incoming_calls,
}


@router.post("/fines/compute", dependencies=[Depends(require_cron_secret_dep)])
async def compute():
    admin = get_supabase_admin()
    date_str, start_iso, end_iso = _tashkent_today()

    fine_types = (
        admin.table("fine_types")
        .select("id, organization_id, name, default_amount, target_positions")
        .not_.is_("default_amount", "null")
        .execute()
        .data
        or []
    )

    types_checked = 0
    fines_created = 0

    for fine_type in fine_types:
        check = _RULE_CHECKS.get(fine_type["name"])
        if not check:
            continue
        try:
            eligible_profile_ids: set[str] | None = None
            target_positions = fine_type.get("target_positions")
            if target_positions:
                profiles = (
                    admin.table("profiles")
                    .select("id, position")
                    .eq("organization_id", fine_type["organization_id"])
                    .in_("position", target_positions)
                    .execute()
                    .data
                    or []
                )
                eligible_profile_ids = {p["id"] for p in profiles}
            created = await check(
                fine_type["organization_id"], fine_type, date_str, start_iso, end_iso, eligible_profile_ids
            )
            fines_created += created
            types_checked += 1
        except Exception as err:
            print(f"[fines.compute] fine_type {fine_type['id']} failed: {err}")

    return {"typesChecked": types_checked, "finesCreated": fines_created}


def _escape_html(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


class PublishBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    from_: str | None = Field(default=None, alias="from")
    to: str | None = None
    label: str | None = None


@router.post("/fines/publish")
async def publish(body: PublishBody, authorization: str | None = Header(default=None)):
    user_id = await get_request_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    admin = get_supabase_admin()
    caller = (
        admin.table("profiles")
        .select("role, organization_id")
        .eq("id", user_id)
        .maybe_single()
        .execute()
        .data
    )
    is_manager = caller and caller.get("role") in ("super_admin", "platform_owner", "rop")
    if not is_manager or not caller.get("organization_id"):
        raise HTTPException(status_code=403, detail="Forbidden")
    organization_id = caller["organization_id"]

    fines_query = admin.table("fines").select("amount, fine_type_id, profile_id").eq(
        "organization_id", organization_id
    )
    if body.from_:
        fines_query = fines_query.gte("occurred_on", body.from_[:10])
    if body.to:
        fines_query = fines_query.lte("occurred_on", body.to[:10])
    fines = fines_query.execute().data or []

    fine_types = (
        admin.table("fine_types").select("id, name").eq("organization_id", organization_id).execute().data
        or []
    )
    profiles = (
        admin.table("profiles")
        .select("id, full_name, email")
        .eq("organization_id", organization_id)
        .execute()
        .data
        or []
    )
    type_name = {t["id"]: t["name"] for t in fine_types}
    profile_name = {p["id"]: p.get("full_name") or p.get("email") or "—" for p in profiles}

    by_profile: dict[str, dict[str, Any]] = {}
    for f in fines:
        entry = by_profile.setdefault(
            f["profile_id"],
            {"name": profile_name.get(f["profile_id"], "—"), "total": 0.0, "by_type": {}},
        )
        entry["total"] += float(f["amount"])
        entry["by_type"][f["fine_type_id"]] = entry["by_type"].get(f["fine_type_id"], 0.0) + float(
            f["amount"]
        )

    rows = sorted(by_profile.values(), key=lambda r: r["total"], reverse=True)
    lines = [f"<b>💰 Jarimalar — {_escape_html(body.label or '')}</b>", ""]
    if not rows:
        lines.append("Tanlangan davrda jarima yo'q.")
    else:
        for r in rows:
            details = ", ".join(
                f"{_escape_html(type_name.get(type_id, '?'))}: {amt}"
                for type_id, amt in r["by_type"].items()
            )
            lines.append(f"<b>{_escape_html(r['name'])}</b> — {r['total']} ({details})")
    text = "\n".join(lines)

    recipients = (
        admin.table("profiles")
        .select("telegram_chat_id")
        .eq("organization_id", organization_id)
        .not_.is_("telegram_chat_id", "null")
        .execute()
        .data
        or []
    )

    sent = 0
    for r in recipients:
        chat_id = r.get("telegram_chat_id")
        if not chat_id:
            continue
        try:
            await send_telegram_message(chat_id, text)
            sent += 1
        except Exception:
            pass

    return {"ok": True, "sent": sent}
