"""Port of src/routes/hr.delete-candidate.ts and hr.send-message.ts.

Not yet ported: the HR candidate list/detail *pages* have no backend routes
of their own in the original (they read hr_candidates etc. straight from
the browser via RLS) -- only these two mutation routes exist server-side,
both because they need supabaseAdmin (hr_candidates has no delete policy
for authenticated users) and/or the Telegram bot token.
"""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.auth import get_request_user_id
from app.db import get_supabase_admin
from app.telegram_report import (
    send_hr_telegram_audio,
    send_hr_telegram_document,
    send_hr_telegram_location,
    send_hr_telegram_message,
    send_hr_telegram_photo,
)

router = APIRouter()


async def _require_hr_caller(authorization: str | None) -> dict[str, Any]:
    """Both routes gate on the exact same role check (super_admin or
    platform_owner) -- factored out to avoid repeating it twice, not a new
    rule."""
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
    if not caller or caller["role"] not in ("super_admin", "platform_owner"):
        raise HTTPException(status_code=403, detail="Unauthorized")
    return {"id": user_id, **caller}


class DeleteCandidateBody(BaseModel):
    candidateId: str | None = None
    reason: str | None = None


@router.post("/hr/delete-candidate")
async def delete_candidate(
    body: DeleteCandidateBody, authorization: str | None = Header(default=None)
):
    caller = await _require_hr_caller(authorization)
    admin = get_supabase_admin()

    candidate_id = (body.candidateId or "").strip()
    reason = (body.reason or "").strip()
    if not candidate_id:
        raise HTTPException(status_code=400, detail="candidateId talab qilinadi.")
    if not reason:
        raise HTTPException(status_code=400, detail="O'chirish sababi talab qilinadi.")

    candidate = (
        admin.table("hr_candidates")
        .select("*, hr_vacancies(title), hr_candidate_answers(answer_text, hr_questions(question))")
        .eq("id", candidate_id)
        .maybe_single()
        .execute()
        .data
    )
    if not candidate:
        raise HTTPException(status_code=404, detail="Nomzod topilmadi.")
    if caller["role"] != "platform_owner" and candidate["organization_id"] != caller["organization_id"]:
        raise HTTPException(status_code=403, detail="Unauthorized")

    admin.table("hr_candidate_deletions").insert(
        {
            "organization_id": candidate["organization_id"],
            "candidate_snapshot": candidate,
            "reason": reason,
            "deleted_by": caller["id"],
        }
    ).execute()
    admin.table("hr_candidates").delete().eq("id", candidate_id).execute()

    return {"ok": True}


class SendMessageBody(BaseModel):
    candidateId: str | None = None
    text: str | None = None
    attachmentUrl: str | None = None
    attachmentType: Literal["image", "document", "audio", "location"] | None = None
    locationLat: float | None = None
    locationLng: float | None = None


@router.post("/hr/send-message")
async def send_message(body: SendMessageBody, authorization: str | None = Header(default=None)):
    """Sends a message (plain text, or an attachment/location) to a
    candidate through the Kadrlar bo'limi Telegram bot and only then logs
    it, so hr_candidate_messages never shows an "outbound" row that
    Telegram actually rejected."""
    caller = await _require_hr_caller(authorization)
    admin = get_supabase_admin()

    candidate_id = (body.candidateId or "").strip()
    text = (body.text or "").strip() or None
    attachment_type = body.attachmentType
    attachment_url = (body.attachmentUrl or "").strip() or None

    if not candidate_id:
        raise HTTPException(status_code=400, detail="candidateId talab qilinadi.")
    if attachment_type == "location":
        if body.locationLat is None or body.locationLng is None:
            raise HTTPException(status_code=400, detail="Lokatsiya koordinatalari talab qilinadi.")
    elif attachment_type:
        if not attachment_url:
            raise HTTPException(status_code=400, detail="attachmentUrl talab qilinadi.")
    elif not text:
        raise HTTPException(status_code=400, detail="Xabar matni talab qilinadi.")

    candidate = (
        admin.table("hr_candidates")
        .select("id, organization_id, telegram_chat_id")
        .eq("id", candidate_id)
        .maybe_single()
        .execute()
        .data
    )
    if not candidate:
        raise HTTPException(status_code=404, detail="Nomzod topilmadi.")
    if caller["role"] != "platform_owner" and candidate["organization_id"] != caller["organization_id"]:
        raise HTTPException(status_code=403, detail="Unauthorized")

    chat_id = candidate["telegram_chat_id"]
    try:
        if attachment_type == "image":
            await send_hr_telegram_photo(chat_id, attachment_url, text)
        elif attachment_type == "document":
            await send_hr_telegram_document(chat_id, attachment_url, text)
        elif attachment_type == "audio":
            await send_hr_telegram_audio(chat_id, attachment_url, text)
        elif attachment_type == "location":
            await send_hr_telegram_location(chat_id, body.locationLat, body.locationLng)
            if text:
                await send_hr_telegram_message(chat_id, text)
        else:
            await send_hr_telegram_message(chat_id, text)
    except Exception as err:
        raise HTTPException(
            status_code=502, detail=str(err) or "Telegramga yuborib bo'lmadi."
        ) from err

    message = (
        admin.table("hr_candidate_messages")
        .insert(
            {
                "organization_id": candidate["organization_id"],
                "candidate_id": candidate["id"],
                "direction": "outbound",
                "body": text,
                "attachment_url": attachment_url if attachment_type != "location" else None,
                "attachment_type": attachment_type,
                "location_lat": body.locationLat if attachment_type == "location" else None,
                "location_lng": body.locationLng if attachment_type == "location" else None,
                "sent_by": caller["id"],
            }
        )
        .select()
        .single()
        .execute()
        .data
    )
    return message
