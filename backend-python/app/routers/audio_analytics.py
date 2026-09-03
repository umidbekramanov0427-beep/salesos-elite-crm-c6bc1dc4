"""Port of src/routes/audio-analytics.analyze.ts (the route handler only --
the actual work is in app/audio_analytics.py, see that module's docstring)
and audio-analytics.analyze-pending.ts (the cron sweep for unanalyzed
calls, same reasoning as the original: virtually nothing ever got analyzed
via the manual button alone at real call volume).
"""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from app.audio_analytics import analyze_call_by_id
from app.auth import get_request_user_id, require_cron_secret_dep
from app.db import get_supabase_admin

router = APIRouter()


class AnalyzeBody(BaseModel):
    callId: str | None = None


@router.post("/audio-analytics/analyze")
async def analyze(body: AnalyzeBody, authorization: str | None = Header(default=None)):
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
    if not body.callId:
        raise HTTPException(status_code=400, detail="callId is required.")

    try:
        return await analyze_call_by_id(caller["organization_id"], body.callId)
    except Exception as err:
        raise HTTPException(
            status_code=500, detail=str(err) or "Tahlil qilishda xatolik yuz berdi."
        ) from err


# Analyzed concurrently (asyncio.gather), not sequentially -- each call is a
# slow, independent Whisper+Gemini round trip, so running a batch in
# parallel keeps total wall time close to one call's instead of the sum of
# all of them. Kept modest to stay within typical OpenAI/Gemini per-minute
# rate limits; a bigger backlog just clears over a few more 5-minute ticks.
_BATCH_LIMIT = 8


@router.post("/audio-analytics/analyze-pending", dependencies=[Depends(require_cron_secret_dep)])
async def analyze_pending():
    admin = get_supabase_admin()
    pending = (
        admin.table("amocrm_calls")
        .select("id, organization_id")
        .not_.is_("recording_url", "null")
        .is_("analyzed_at", "null")
        .order("occurred_at")
        .limit(_BATCH_LIMIT)
        .execute()
        .data
        or []
    )

    results = await asyncio.gather(
        *(analyze_call_by_id(call["organization_id"], call["id"]) for call in pending),
        return_exceptions=True,
    )
    analyzed = sum(1 for r in results if not isinstance(r, Exception))
    failed = len(results) - analyzed

    return {"total": len(results), "analyzed": analyzed, "failed": failed}
