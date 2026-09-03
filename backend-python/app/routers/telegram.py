"""Port of src/routes/telegram.send-test.ts and
src/routes/telegram.send-daily-report.ts.

Not yet ported from the original telegram.* routes: telegram.webhook.ts
(main bot conversation flow), telegram.hr-webhook.ts (HR bot), telegram.link.ts
(chat-linking code exchange) -- see PORT_STATUS.md.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException

from app.auth import AuthedAdmin, require_cron_secret_dep, require_org_member
from app.daily_report_builder import build_full_daily_report, build_personal_daily_report
from app.db import get_supabase_admin
from app.telegram_report import send_daily_report_to_linked_managers, send_telegram_message

router = APIRouter()


@router.post("/telegram/send-test")
async def send_test(authorization: str | None = Header(default=None)):
    user: AuthedAdmin | None = await require_org_member(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    admin = get_supabase_admin()
    profile = (
        admin.table("profiles")
        .select("telegram_chat_id, organization_id, role")
        .eq("id", user.id)
        .maybe_single()
        .execute()
        .data
    )
    if not profile or not profile.get("telegram_chat_id"):
        raise HTTPException(status_code=400, detail="Telegram not linked yet")
    if not profile.get("organization_id"):
        raise HTTPException(status_code=400, detail="No organization")

    try:
        if profile["role"] == "sotuv_menejeri":
            text = await build_personal_daily_report(profile["organization_id"], user.id)
        else:
            text = (await build_full_daily_report(profile["organization_id"]))["text"]
        await send_telegram_message(profile["telegram_chat_id"], text)
        return {"ok": True}
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err) or "Failed to send") from err


@router.post("/telegram/send-daily-report", dependencies=[Depends(require_cron_secret_dep)])
async def send_daily_report():
    try:
        return await send_daily_report_to_linked_managers()
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err) or "Failed to send report") from err
