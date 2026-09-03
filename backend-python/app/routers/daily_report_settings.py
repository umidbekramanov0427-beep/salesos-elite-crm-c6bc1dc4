"""Port of src/routes/daily-report-settings.preview.ts and
daily-report-settings.generate-now.ts.

Both are thin wrappers around code already ported in app/daily_report_builder.py
and app/telegram_report.py -- preview.ts calls buildFullDailyReport directly
(read-only, no delivery) so the "Hisobot namunasi" preview and the real
scheduled Telegram send can never drift apart; generate-now.ts calls
sendDailyReportForOrg, the exact same delivery path used by the scheduled
job (telegram.send-daily-report.ts), for the "Hisobotni hoziroq yaratish"
manual trigger button.
"""

from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException

from app.auth import get_request_user_id
from app.daily_report_builder import build_full_daily_report
from app.db import get_supabase_admin
from app.telegram_report import send_daily_report_for_org

router = APIRouter()


@router.get("/daily-report-settings/preview")
async def preview(authorization: str | None = Header(default=None)):
    user_id = await get_request_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    admin = get_supabase_admin()
    caller = (
        admin.table("profiles")
        .select("organization_id")
        .eq("id", user_id)
        .maybe_single()
        .execute()
        .data
    )
    if not caller or not caller.get("organization_id"):
        raise HTTPException(status_code=401, detail="Unauthorized")

    return await build_full_daily_report(caller["organization_id"])


@router.post("/daily-report-settings/generate-now")
async def generate_now(authorization: str | None = Header(default=None)):
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
    if not caller or caller.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Unauthorized")
    if not caller.get("organization_id"):
        raise HTTPException(status_code=400, detail="Kompaniya topilmadi.")

    try:
        return await send_daily_report_for_org(caller["organization_id"])
    except Exception as err:
        raise HTTPException(
            status_code=500, detail=str(err) or "Hisobotni yaratib bo'lmadi."
        ) from err
