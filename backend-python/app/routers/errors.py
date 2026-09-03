"""Port of src/routes/errors.log.ts -- kept as the first, simplest
end-to-end example of the porting pattern: Pydantic body model instead of
a hand-checked `Body` type, a FastAPI dependency instead of manually
reading the Authorization header, otherwise line-for-line the same
behavior (including "auth is optional -- log the error either way")."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header
from pydantic import BaseModel

from app.auth import get_request_user_id
from app.db import get_supabase_admin

router = APIRouter()


class ErrorLogBody(BaseModel):
    message: str | None = None
    stack: str | None = None
    source: str | None = None
    route: str | None = None
    context: dict[str, Any] | None = None


def _clamp(value: str | None, max_len: int) -> str | None:
    if not value:
        return value
    return value[:max_len] if len(value) > max_len else value


@router.post("/errors/log")
async def log_error(body: ErrorLogBody, authorization: str | None = Header(default=None)):
    message = _clamp(body.message, 2000)
    if not message:
        return {"error": "message is required"}, 400

    user_id = await get_request_user_id(authorization)

    admin = get_supabase_admin()
    admin.table("error_logs").insert(
        {
            "message": message,
            "stack": _clamp(body.stack, 8000),
            "source": body.source or "client",
            "route": body.route,
            "user_id": user_id,
            "context": body.context or {},
        }
    ).execute()

    return {"ok": True}
