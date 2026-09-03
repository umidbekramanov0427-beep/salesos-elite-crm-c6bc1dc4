"""Port of src/lib/telegram-report.server.ts.

Builds the daily team report text and sends it via the Telegram Bot API.
Used by both the scheduled send and the "send test" button, so the two
never drift apart -- same as the original.
"""

from __future__ import annotations

import os
import uuid

import httpx

from app.daily_report_builder import build_full_daily_report, build_personal_daily_report
from app.db import get_supabase_admin
from app.google_sheets import append_row_to_google_sheet


def _require_bot_token() -> str:
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        raise RuntimeError("Missing environment variable: TELEGRAM_BOT_TOKEN")
    return token


def _require_hr_bot_token() -> str:
    token = os.environ.get("TELEGRAM_HR_BOT_TOKEN")
    if not token:
        raise RuntimeError("Missing environment variable: TELEGRAM_HR_BOT_TOKEN")
    return token


async def _call_telegram_method(token: str, method: str, payload: dict) -> None:
    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.post(f"https://api.telegram.org/bot{token}/{method}", json=payload)
    if res.status_code >= 400:
        raise RuntimeError(f"Telegram {method} failed ({res.status_code}): {res.text}")


async def _send_via_bot_token(token: str, chat_id: int, text: str) -> None:
    await _call_telegram_method(
        token, "sendMessage", {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    )


async def send_telegram_message(chat_id: int, text: str) -> None:
    await _send_via_bot_token(_require_bot_token(), chat_id, text)


# Kadrlar bo'limi runs on its own, separate Telegram bot (not the reports/
# onboarding bot above) -- Telegram gives a webhook no way to tell which bot
# an update came through, so two unrelated bots can never safely share one
# webhook route or token.
async def send_hr_telegram_message(chat_id: int, text: str) -> None:
    await _send_via_bot_token(_require_hr_bot_token(), chat_id, text)


async def send_hr_telegram_photo(chat_id: int, photo_url: str, caption: str | None = None) -> None:
    await _call_telegram_method(
        _require_hr_bot_token(), "sendPhoto", {"chat_id": chat_id, "photo": photo_url, "caption": caption}
    )


async def send_hr_telegram_document(
    chat_id: int, document_url: str, caption: str | None = None
) -> None:
    await _call_telegram_method(
        _require_hr_bot_token(),
        "sendDocument",
        {"chat_id": chat_id, "document": document_url, "caption": caption},
    )


async def send_hr_telegram_audio(chat_id: int, audio_url: str, caption: str | None = None) -> None:
    await _call_telegram_method(
        _require_hr_bot_token(), "sendAudio", {"chat_id": chat_id, "audio": audio_url, "caption": caption}
    )


async def send_hr_telegram_location(chat_id: int, lat: float, lng: float) -> None:
    await _call_telegram_method(
        _require_hr_bot_token(),
        "sendLocation",
        {"chat_id": chat_id, "latitude": lat, "longitude": lng},
    )


async def rehost_hr_telegram_file(file_id: str, ext_hint: str) -> str:
    """Resolves a Telegram file_id to bytes and re-hosts it in our own
    storage, so the CRM's chat panel can display it without ever handing the
    bot token to the browser (Telegram's file-download URL embeds it)."""
    token = _require_hr_bot_token()
    async with httpx.AsyncClient(timeout=30) as client:
        info_res = await client.get(f"https://api.telegram.org/bot{token}/getFile", params={"file_id": file_id})
        info = info_res.json()
        file_path = (info.get("result") or {}).get("file_path")
        if not info.get("ok") or not file_path:
            raise RuntimeError("Telegram getFile failed")

        file_res = await client.get(f"https://api.telegram.org/file/bot{token}/{file_path}")
        if file_res.status_code >= 400:
            raise RuntimeError(f"Telegram file download failed ({file_res.status_code})")
        content = file_res.content
        content_type = file_res.headers.get("content-type")

    ext = file_path.rsplit(".", 1)[-1] if "." in file_path else ext_hint
    object_path = f"telegram/{uuid.uuid4()}.{ext or ext_hint}"
    admin = get_supabase_admin()
    admin.storage.from_("hr-chat-attachments").upload(
        object_path, content, {"content-type": content_type} if content_type else None
    )
    return admin.storage.from_("hr-chat-attachments").get_public_url(object_path)


# Every org's send time is entered and shown as a Tashkent wall-clock time
# (the platform's one supported business timezone) -- these convert between
# that and the UTC clock this server actually runs on.
def _tashkent_now():
    from datetime import datetime, timedelta, timezone

    return datetime.now(timezone.utc) + timedelta(hours=5)


def _tashkent_date_string() -> str:
    return _tashkent_now().date().isoformat()


def _is_within_send_window(send_time: str, window_minutes: int) -> bool:
    h, m = (int(x) for x in send_time.split(":")[:2])
    target_minutes = h * 60 + m
    now = _tashkent_now()
    now_minutes = now.hour * 60 + now.minute
    diff = (now_minutes - target_minutes + 1440) % 1440
    return diff < window_minutes


async def send_daily_report_for_org(organization_id: str) -> dict[str, int]:
    """Builds and delivers one org's full daily report unconditionally --
    ignores send_enabled/send_time/"already sent today" (those gates live in
    the scheduled caller below). Saves it into daily_report_history
    (overwriting today's row if one exists), pushes it to the org's Google
    Sheet if configured, and sends each linked recipient a report scoped to
    their own role -- same behavior as the original, see its own docstring
    there for the full per-role breakdown."""
    admin = get_supabase_admin()

    full = await build_full_daily_report(organization_id, include_marketing_section=True)
    full_text = full["text"]
    report_date = _tashkent_date_string()

    admin.table("daily_report_history").upsert(
        {"organization_id": organization_id, "report_date": report_date, "report_text": full_text},
        on_conflict="organization_id,report_date",
    ).execute()

    report_settings = (
        admin.table("daily_report_settings")
        .select("google_sheets_url")
        .eq("organization_id", organization_id)
        .maybe_single()
        .execute()
        .data
    )
    if report_settings and report_settings.get("google_sheets_url"):
        try:
            await append_row_to_google_sheet(
                report_settings["google_sheets_url"], [report_date, full_text]
            )
        except Exception:
            pass  # Sheets push failing must never block the Telegram sends below.

    recipients = (
        admin.table("profiles")
        .select("id, telegram_chat_id, role")
        .eq("organization_id", organization_id)
        .not_.is_("telegram_chat_id", "null")
        .in_("role", ["super_admin", "rop", "sotuv_menejeri"])
        .execute()
        .data
        or []
    )

    reports_by_manager_id: dict[str, list[str]] | None = None
    if any(r["role"] == "rop" for r in recipients):
        reps = (
            admin.table("profiles")
            .select("id, manager_id")
            .eq("organization_id", organization_id)
            .eq("role", "sotuv_menejeri")
            .execute()
            .data
            or []
        )
        reports_by_manager_id = {}
        for rep in reps:
            if not rep.get("manager_id"):
                continue
            reports_by_manager_id.setdefault(rep["manager_id"], []).append(rep["id"])

    sent = 0
    failed = 0
    for r in recipients:
        chat_id = r.get("telegram_chat_id")
        if not chat_id:
            continue
        try:
            if r["role"] == "sotuv_menejeri":
                text = await build_personal_daily_report(organization_id, r["id"])
            elif r["role"] == "rop":
                scope = [r["id"], *(reports_by_manager_id or {}).get(r["id"], [])]
                text = (await build_full_daily_report(organization_id, owner_scope=scope))["text"]
            else:
                text = full_text
            await send_telegram_message(chat_id, text)
            sent += 1
        except Exception:
            failed += 1
    return {"sent": sent, "failed": failed}


async def send_daily_report_to_linked_managers() -> dict[str, int]:
    """Polled every few minutes (see the pg_cron migration); actually sends
    for an org only once its own configured send_time comes around, and at
    most once per org per day (daily_report_history doubles as the "already
    sent today" guard)."""
    admin = get_supabase_admin()
    orgs = admin.table("organizations").select("id").eq("active", True).execute().data or []

    sent = 0
    failed = 0
    report_date = _tashkent_date_string()
    for org in orgs:
        report_settings = (
            admin.table("daily_report_settings")
            .select("send_enabled, send_time")
            .eq("organization_id", org["id"])
            .maybe_single()
            .execute()
            .data
        )
        if report_settings is not None and report_settings.get("send_enabled") is False:
            continue

        already_sent = (
            admin.table("daily_report_history")
            .select("id")
            .eq("organization_id", org["id"])
            .eq("report_date", report_date)
            .maybe_single()
            .execute()
            .data
        )
        if already_sent:
            continue

        send_time = (report_settings or {}).get("send_time") or "23:50:00"
        if not _is_within_send_window(send_time, 5):
            continue

        result = await send_daily_report_for_org(org["id"])
        sent += result["sent"]
        failed += result["failed"]
    return {"sent": sent, "failed": failed}
