"""Port of src/lib/auth.server.ts.

The frontend keeps sending the Supabase JWT as `Authorization: Bearer
<token>` on every server-route call (no cookie session -- see the original
file's comment on this). This module resolves that token to a user id and
role exactly like the TypeScript version, using the SAME Supabase Auth
project (no user migration needed).
"""

from __future__ import annotations

from fastapi import Header, HTTPException

from app.db import get_supabase_admin


async def get_user_id_from_token(token: str) -> str | None:
    """Port of getUserIdFromToken -- validates the JWT via Supabase Auth and
    returns the subject (user id), or None if it doesn't resolve."""
    if token.count(".") != 2:
        return None
    admin = get_supabase_admin()
    try:
        resp = admin.auth.get_user(token)
    except Exception:
        return None
    return resp.user.id if resp and resp.user else None


async def get_request_user_id(authorization: str | None) -> str | None:
    """Port of getRequestUserId -- pass the raw `Authorization` header value."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    return await get_user_id_from_token(authorization.removeprefix("Bearer "))


class AuthedAdmin:
    def __init__(self, id: str, organization_id: str):
        self.id = id
        self.organization_id = organization_id


async def require_super_admin_for_user(user_id: str) -> AuthedAdmin | None:
    """Port of requireSuperAdminForUser -- admits super_admin and
    platform_owner, same as the original."""
    admin = get_supabase_admin()
    res = (
        admin.table("profiles")
        .select("id, role, organization_id")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    row = res.data
    if not row or row.get("role") not in ("super_admin", "platform_owner"):
        return None
    if not row.get("organization_id"):
        return None
    return AuthedAdmin(id=row["id"], organization_id=row["organization_id"])


async def require_org_member(authorization: str | None) -> AuthedAdmin | None:
    """Port of requireOrgMember -- any authenticated org member, no role
    check (data routes every role may read, e.g. their own Dashboard)."""
    user_id = await get_request_user_id(authorization)
    if not user_id:
        return None
    admin = get_supabase_admin()
    res = (
        admin.table("profiles")
        .select("organization_id")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    row = res.data
    if not row or not row.get("organization_id"):
        return None
    return AuthedAdmin(id=user_id, organization_id=row["organization_id"])


async def require_super_admin(authorization: str | None) -> AuthedAdmin | None:
    user_id = await get_request_user_id(authorization)
    return await require_super_admin_for_user(user_id) if user_id else None


# --- FastAPI dependency wrappers -------------------------------------------
# Use these directly as route dependencies, e.g.:
#   @router.post("/errors/log")
#   async def log_error(admin: AuthedAdmin | None = Depends(optional_org_member)):


async def require_super_admin_dep(
    authorization: str | None = Header(default=None),
) -> AuthedAdmin:
    admin = await require_super_admin(authorization)
    if not admin:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return admin


async def require_org_member_dep(
    authorization: str | None = Header(default=None),
) -> AuthedAdmin:
    admin = await require_org_member(authorization)
    if not admin:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return admin


async def optional_user_id_dep(
    authorization: str | None = Header(default=None),
) -> str | None:
    return await get_request_user_id(authorization)
