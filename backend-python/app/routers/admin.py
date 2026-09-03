"""Port of the admin.*.ts routes that aren't AmoCRM-related (those wait
for the AmoCRM phase -- see PORT_STATUS.md): admin.create-employee.ts,
admin.delete-employee.ts, admin.set-employee-password.ts,
admin.security-ban.ts, admin.security-users.ts, admin.ai-agents.update.ts.

Every route here returns 403 (not 401) for "not authorized" -- matching the
original exactly; other route families in this port (telegram.*, hr.*) use
401 for their own equivalent because that's what *those* originals do. Not
an inconsistency introduced here -- ported faithfully per file.
"""

from __future__ import annotations

import re
from typing import Any, Literal

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.auth import AuthedAdmin, require_super_admin
from app.db import get_supabase_admin
from app.organization_admin_credentials import sync_org_admin_credentials

router = APIRouter()


async def _require_admin(authorization: str | None) -> AuthedAdmin:
    admin = await require_super_admin(authorization)
    if not admin:
        raise HTTPException(status_code=403, detail="Unauthorized")
    return admin


class CreateEmployeeBody(BaseModel):
    email: str | None = None
    password: str | None = None
    full_name: str | None = None


@router.post("/admin/create-employee")
async def create_employee(
    body: CreateEmployeeBody, authorization: str | None = Header(default=None)
):
    caller = await _require_admin(authorization)
    admin = get_supabase_admin()

    email = (body.email or "").strip()
    password = body.password
    full_name = (body.full_name or "").strip()
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required.")

    policy = (
        admin.table("security_settings")
        .select("min_password_length, require_number, require_uppercase, require_symbol")
        .eq("organization_id", caller.organization_id)
        .maybe_single()
        .execute()
        .data
    )
    min_length = (policy or {}).get("min_password_length") or 8
    if (
        len(password) < min_length
        or ((policy or {}).get("require_number") and not re.search(r"[0-9]", password))
        or ((policy or {}).get("require_uppercase") and not re.search(r"[A-Z]", password))
        or ((policy or {}).get("require_symbol") and not re.search(r"[^A-Za-z0-9]", password))
    ):
        reqs = [f"{min_length}+ belgi"]
        if (policy or {}).get("require_number"):
            reqs.append("kamida bitta raqam")
        if (policy or {}).get("require_uppercase"):
            reqs.append("kamida bitta bosh harf")
        if (policy or {}).get("require_symbol"):
            reqs.append("kamida bitta maxsus belgi")
        raise HTTPException(status_code=400, detail=f"Parol talablari: {', '.join(reqs)}.")

    try:
        result = admin.auth.admin.create_user(
            {
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {
                    "full_name": full_name,
                    "organization_id": caller.organization_id,
                },
            }
        )
    except Exception as err:
        raise HTTPException(
            status_code=400, detail=str(err) or "Could not create the account."
        ) from err
    return {"id": result.user.id}


class DeleteEmployeeBody(BaseModel):
    id: str | None = None


@router.post("/admin/delete-employee")
async def delete_employee(
    body: DeleteEmployeeBody, authorization: str | None = Header(default=None)
):
    caller = await _require_admin(authorization)
    admin = get_supabase_admin()

    target_id = (body.id or "").strip()
    if not target_id:
        raise HTTPException(status_code=400, detail="Employee id is required.")
    if target_id == caller.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account.")

    target = (
        admin.table("profiles")
        .select("organization_id")
        .eq("id", target_id)
        .maybe_single()
        .execute()
        .data
    )
    if not target or target["organization_id"] != caller.organization_id:
        raise HTTPException(status_code=404, detail="Employee not found.")

    try:
        admin.auth.admin.delete_user(target_id)
    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    return {"ok": True}


class SetEmployeePasswordBody(BaseModel):
    id: str | None = None
    password: str | None = None


@router.post("/admin/set-employee-password")
async def set_employee_password(
    body: SetEmployeePasswordBody, authorization: str | None = Header(default=None)
):
    caller = await _require_admin(authorization)
    admin = get_supabase_admin()

    target_id = (body.id or "").strip()
    password = body.password or ""
    if not target_id:
        raise HTTPException(status_code=400, detail="Employee id is required.")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    target = (
        admin.table("profiles")
        .select("organization_id, role, email")
        .eq("id", target_id)
        .maybe_single()
        .execute()
        .data
    )
    if not target or target["organization_id"] != caller.organization_id:
        raise HTTPException(status_code=404, detail="Employee not found.")
    if target["role"] == "platform_owner":
        raise HTTPException(status_code=400, detail="Platform owner accounts can't be edited here.")

    try:
        admin.auth.admin.update_user_by_id(target_id, {"password": password})
    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err)) from err

    if target["role"] == "super_admin":
        await sync_org_admin_credentials(target["organization_id"], target_id, target["email"], password)

    return {"ok": True}


class SecurityBanBody(BaseModel):
    userId: str | None = None
    ban: bool = False


# Supabase's Admin API has no per-session "sign this device out" call keyed
# by user id -- ban_duration is the real, working equivalent: it rejects
# every future token refresh for that account, which is what actually
# matters for locking someone out.
_BAN_DURATION = "876000h"  # ~100 years -- GoTrue's own convention for "indefinite"


@router.post("/admin/security-ban")
async def security_ban(body: SecurityBanBody, authorization: str | None = Header(default=None)):
    caller = await _require_admin(authorization)
    admin = get_supabase_admin()

    user_id = (body.userId or "").strip()
    if not user_id:
        raise HTTPException(status_code=400, detail="userId is required.")
    if user_id == caller.id:
        raise HTTPException(status_code=400, detail="You can't block your own account.")

    target = (
        admin.table("profiles")
        .select("organization_id")
        .eq("id", user_id)
        .maybe_single()
        .execute()
        .data
    )
    if not target or target["organization_id"] != caller.organization_id:
        raise HTTPException(status_code=404, detail="User not found.")

    try:
        admin.auth.admin.update_user_by_id(
            user_id, {"ban_duration": _BAN_DURATION if body.ban else "none"}
        )
    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    return {"ok": True}


@router.get("/admin/security-users")
async def security_users(authorization: str | None = Header(default=None)):
    """last_sign_in_at / banned_until live on auth.users, not the public
    profiles table the client can read directly -- this is the only place
    that data is exposed, service-role only, scoped to the caller's own
    org's profile ids so one org's admin can never see another org's login
    activity."""
    caller = await _require_admin(authorization)
    admin = get_supabase_admin()

    profiles = (
        admin.table("profiles")
        .select("id")
        .eq("organization_id", caller.organization_id)
        .execute()
        .data
        or []
    )
    results = []
    for p in profiles:
        try:
            user = admin.auth.admin.get_user_by_id(p["id"]).user
        except Exception:
            user = None
        results.append(
            {
                "id": p["id"],
                "last_sign_in_at": getattr(user, "last_sign_in_at", None),
                "banned_until": getattr(user, "banned_until", None),
            }
        )
    return {"users": results}


class AiAgentsUpdateBody(BaseModel):
    kind: Literal["chat", "call"]
    model: str | None = None
    system_prompt: str | None = None
    channels: list[str] | None = None
    active: bool | None = None
    call_instructions: dict[str, Any] | None = None


@router.post("/admin/ai-agents/update")
async def ai_agents_update(
    body: AiAgentsUpdateBody, authorization: str | None = Header(default=None)
):
    """Client-side upserts to ai_agents kept failing RLS for a confirmed
    super_admin in the original -- this sidesteps client-side RLS entirely:
    auth is enforced here, and the write goes through the service-role
    client. See the original file's comment for the full story."""
    caller = await _require_admin(authorization)
    admin = get_supabase_admin()

    row: dict[str, Any] = {
        "organization_id": caller.organization_id,
        "kind": body.kind,
        "updated_by": caller.id,
    }
    if body.model is not None:
        row["model"] = body.model
    if body.system_prompt is not None:
        row["system_prompt"] = body.system_prompt
    if body.channels is not None:
        row["channels"] = body.channels
    if body.active is not None:
        row["active"] = body.active
    if body.call_instructions is not None:
        row["call_instructions"] = body.call_instructions

    try:
        admin.table("ai_agents").upsert(row, on_conflict="organization_id,kind").execute()
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err)) from err
    return {"ok": True}
