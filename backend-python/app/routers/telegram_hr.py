"""Port of src/routes/telegram.hr-webhook.ts -- webhook for the dedicated
Kadrlar bo'limi Telegram bot, a separate bot/token from the reports+
onboarding bot in telegram.py's /telegram/webhook, on its own URL, since
Telegram gives no way to tell which bot an update came through when two
bots share one webhook.
"""

from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request

from app.db import get_supabase_admin
from app.telegram_report import rehost_hr_telegram_file, send_hr_telegram_message

router = APIRouter()

_START_RE = re.compile(r"^/start\s+(\S+)")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _start_hr_application(chat_id: int, token: str, username: str | None) -> None:
    """A job-posting link is `t.me/<hr-bot>?start=<token>`, which Telegram
    delivers to the webhook as the literal message text "/start <token>". A
    chat that has ever applied before (to this or any other vacancy) is
    refused a second application -- see hr_candidates_telegram_chat_id_key."""
    admin = get_supabase_admin()

    existing = (
        admin.table("hr_candidates")
        .select("id")
        .eq("telegram_chat_id", chat_id)
        .limit(1)
        .maybe_single()
        .execute()
        .data
    )
    if existing:
        try:
            await send_hr_telegram_message(
                chat_id,
                "Siz allaqachon ariza topshirgansiz. Har bir nomzod faqat bir marta ariza "
                "topshira oladi.",
            )
        except Exception:
            pass
        return

    vacancy = (
        admin.table("hr_vacancies")
        .select("id, organization_id, title, active")
        .eq("telegram_start_token", token)
        .maybe_single()
        .execute()
        .data
    )
    if not vacancy or not vacancy.get("active"):
        try:
            await send_hr_telegram_message(
                chat_id, "Bu vakansiya havolasi topilmadi yoki endi faol emas."
            )
        except Exception:
            pass
        return

    questions = (
        admin.table("hr_questions")
        .select("id, question, position")
        .eq("organization_id", vacancy["organization_id"])
        .order("position")
        .execute()
        .data
        or []
    )
    if not questions:
        try:
            await send_hr_telegram_message(
                chat_id,
                "Hozircha bu vakansiya uchun savollar sozlanmagan. Iltimos, keyinroq qayta "
                "urinib ko'ring.",
            )
        except Exception:
            pass
        return

    try:
        admin.table("hr_candidates").insert(
            {
                "organization_id": vacancy["organization_id"],
                "vacancy_id": vacancy["id"],
                "telegram_chat_id": chat_id,
                "telegram_username": username,
                "current_question_position": 0,
            }
        ).execute()
    except Exception as err:
        # 23505 = unique_violation -- a second /start slipped in before the
        # pre-check above completed; treat it the same as the normal
        # duplicate case.
        message = (
            "Siz allaqachon ariza topshirgansiz. Har bir nomzod faqat bir marta ariza "
            "topshira oladi."
            if "23505" in str(err)
            else "Arizangizni saqlab bo'lmadi. Iltimos, keyinroq qayta urinib ko'ring."
        )
        try:
            await send_hr_telegram_message(chat_id, message)
        except Exception:
            pass
        return

    try:
        await send_hr_telegram_message(
            chat_id,
            f'Assalomu alaykum! "{vacancy["title"]}" vakansiyasiga murojaatingiz uchun '
            f"rahmat. Sizga bir nechta savol beramiz.\n\n{questions[0]['question']}",
        )
    except Exception:
        pass


async def _continue_hr_application(chat_id: int, answer_text: str) -> bool:
    """Any incoming text from a chat with an unfinished application is that
    application's next answer."""
    admin = get_supabase_admin()
    candidate = (
        admin.table("hr_candidates")
        .select("id, organization_id, current_question_position")
        .eq("telegram_chat_id", chat_id)
        .is_("completed_at", "null")
        .order("created_at", desc=True)
        .limit(1)
        .maybe_single()
        .execute()
        .data
    )
    if not candidate:
        return False

    questions = (
        admin.table("hr_questions")
        .select("id, question, position")
        .eq("organization_id", candidate["organization_id"])
        .order("position")
        .execute()
        .data
        or []
    )
    position = candidate["current_question_position"]
    if position >= len(questions):
        return False
    current_question = questions[position]

    admin.table("hr_candidate_answers").upsert(
        {
            "organization_id": candidate["organization_id"],
            "candidate_id": candidate["id"],
            "question_id": current_question["id"],
            "answer_text": answer_text.strip(),
        },
        on_conflict="candidate_id,question_id",
    ).execute()

    next_position = position + 1
    if next_position < len(questions):
        admin.table("hr_candidates").update(
            {"current_question_position": next_position, "updated_at": _now_iso()}
        ).eq("id", candidate["id"]).execute()
        try:
            await send_hr_telegram_message(chat_id, questions[next_position]["question"])
        except Exception:
            pass
        return True

    admin.table("hr_candidates").update(
        {"completed_at": _now_iso(), "updated_at": _now_iso()}
    ).eq("id", candidate["id"]).execute()

    settings = (
        admin.table("hr_settings")
        .select("academy_channel_invite_link")
        .eq("organization_id", candidate["organization_id"])
        .maybe_single()
        .execute()
        .data
    )
    invite_link = (settings or {}).get("academy_channel_invite_link")
    closing_text = (
        "Rahmat! Barcha savollarga javob berdingiz. Endi "
        f'<a href="{invite_link}">TOP kadrlar akademiyasi</a> kanaliga qo\'shiling — u yerda '
        "keyingi bosqichlar haqida ma'lumot olasiz."
        if invite_link
        else "Rahmat! Barcha savollarga javob berdingiz. Tez orada siz bilan bog'lanamiz."
    )
    try:
        await send_hr_telegram_message(chat_id, closing_text)
    except Exception:
        pass
    return True


async def _log_inbound_message(chat_id: int, message: dict[str, Any]) -> bool:
    """Once a candidate has finished the question flow, _continue_hr_application
    no longer matches their chat (its query only looks at open applications)
    -- any further message from them (text, photo, document, voice/audio, or
    a shared location) is a chat reply, not an answer, and gets appended to
    hr_candidate_messages so it shows up in the CRM's chat panel instead of
    triggering the generic "this is the HR bot" reply."""
    admin = get_supabase_admin()
    candidate = (
        admin.table("hr_candidates")
        .select("id, organization_id")
        .eq("telegram_chat_id", chat_id)
        .order("created_at", desc=True)
        .limit(1)
        .maybe_single()
        .execute()
        .data
    )
    if not candidate:
        return False

    row: dict[str, Any] = {
        "organization_id": candidate["organization_id"],
        "candidate_id": candidate["id"],
        "direction": "inbound",
        "body": (message.get("text") or "").strip() or None,
    }

    try:
        photo = message.get("photo")
        document = message.get("document")
        voice = message.get("voice")
        audio = message.get("audio")
        location = message.get("location")
        if photo:
            largest = photo[-1]
            row["attachment_url"] = await rehost_hr_telegram_file(largest["file_id"], "jpg")
            row["attachment_type"] = "image"
        elif document:
            ext = (document.get("file_name") or "").rsplit(".", 1)[-1] or "bin"
            row["attachment_url"] = await rehost_hr_telegram_file(document["file_id"], ext)
            row["attachment_type"] = "document"
        elif voice:
            row["attachment_url"] = await rehost_hr_telegram_file(voice["file_id"], "ogg")
            row["attachment_type"] = "audio"
        elif audio:
            ext = (audio.get("file_name") or "").rsplit(".", 1)[-1] or "mp3"
            row["attachment_url"] = await rehost_hr_telegram_file(audio["file_id"], ext)
            row["attachment_type"] = "audio"
        elif location:
            row["attachment_type"] = "location"
            row["location_lat"] = location["latitude"]
            row["location_lng"] = location["longitude"]
    except Exception:
        pass  # Re-hosting failed -- still log whatever text came with it, if any.

    if not row.get("body") and not row.get("attachment_type"):
        return True

    admin.table("hr_candidate_messages").insert(row).execute()
    return True


@router.post("/telegram/hr-webhook")
async def hr_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
):
    expected = os.environ.get("TELEGRAM_HR_WEBHOOK_SECRET")
    if expected and x_telegram_bot_api_secret_token != expected:
        raise HTTPException(status_code=401, detail="ok: false")

    try:
        update = await request.json()
    except Exception:
        update = {}
    message = update.get("message")
    chat_id = (message or {}).get("chat", {}).get("id")
    raw_text = (message or {}).get("text") or ""
    if not chat_id or not message:
        return {"ok": True}

    start_match = _START_RE.match(raw_text)
    if start_match:
        await _start_hr_application(chat_id, start_match.group(1), message["chat"].get("username"))
        return {"ok": True}

    if await _continue_hr_application(chat_id, raw_text):
        return {"ok": True}

    if await _log_inbound_message(chat_id, message):
        return {"ok": True}

    try:
        await send_hr_telegram_message(
            chat_id,
            "Salom! Bu Kadrlar bo'limi boti — vakansiya e'lonidagi havola orqali murojaat "
            "qilishingiz mumkin.",
        )
    except Exception:
        pass
    return {"ok": True}
