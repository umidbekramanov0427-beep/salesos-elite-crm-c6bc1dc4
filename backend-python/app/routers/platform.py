"""Port of platform.create-organization.ts, platform.add-employee.ts,
platform.delete-user.ts, platform.update-user.ts,
platform.company-directory.ts, platform.deactivate-expired-trials.ts,
platform.delete-organization.ts.

Not yet ported: platform.ai.tsx / platform.activity.tsx / etc. are
frontend-only pages with no backend route in the original (they read
straight from Supabase via RLS, same as most of the app) -- see
PORT_STATUS.md's note on src/hooks/use-crm-data.ts.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.auth import require_platform_owner
from app.db import get_supabase_admin
from app.organization_admin_credentials import sync_org_admin_credentials

router = APIRouter()

_ALLOWED_ROLES = {"super_admin", "rop", "sotuv_menejeri"}


async def _require_owner(authorization: str | None) -> str:
    owner_id = await require_platform_owner(authorization)
    if not owner_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    return owner_id


class CreateOrganizationBody(BaseModel):
    name: str | None = None
    admin_email: str | None = None
    admin_password: str | None = None
    admin_full_name: str | None = None
    rop_email: str | None = None
    rop_password: str | None = None
    rop_full_name: str | None = None
    phone: str | None = None
    plan: str | None = None
    trial_days: int | None = None


@router.post("/platform/create-organization")
async def create_organization(
    body: CreateOrganizationBody, authorization: str | None = Header(default=None)
):
    owner_id = await _require_owner(authorization)
    admin = get_supabase_admin()

    name = (body.name or "").strip()
    email = (body.admin_email or "").strip()
    password = body.admin_password
    full_name = (body.admin_full_name or "").strip()
    rop_email = (body.rop_email or "").strip()
    rop_password = body.rop_password
    rop_full_name = (body.rop_full_name or "").strip()

    if not name or not email or not password or len(password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Company name, admin email and an 8+ character password are required.",
        )
    if not rop_email or not rop_password or len(rop_password) < 8:
        raise HTTPException(
            status_code=400,
            detail="A ROP (department head) email and an 8+ character password are required.",
        )

    phone = (body.phone or "").strip() or None
    plan = (body.plan or "").strip() or "Basic"
    trial_days = body.trial_days if body.trial_days and body.trial_days > 0 else None
    trial_ends_at = (
        (datetime.now(timezone.utc) + timedelta(days=trial_days)).isoformat()
        if trial_days
        else None
    )

    try:
        org = (
            admin.table("organizations")
            .insert(
                {
                    "name": name,
                    "created_by": owner_id,
                    "phone": phone,
                    "plan": plan,
                    "trial_ends_at": trial_ends_at,
                }
            )
            .select()
            .single()
            .execute()
            .data
        )
    except Exception as err:
        raise HTTPException(
            status_code=400, detail=str(err) or "Could not create the organization."
        ) from err

    try:
        admin_user = admin.auth.admin.create_user(
            {
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {
                    "full_name": full_name,
                    "role": "super_admin",
                    "organization_id": org["id"],
                },
            }
        ).user
    except Exception as err:
        admin.table("organizations").delete().eq("id", org["id"]).execute()
        raise HTTPException(
            status_code=400, detail=str(err) or "Could not create the admin account."
        ) from err
    await sync_org_admin_credentials(org["id"], admin_user.id, email, password)

    try:
        rop_user = admin.auth.admin.create_user(
            {
                "email": rop_email,
                "password": rop_password,
                "email_confirm": True,
                "user_metadata": {
                    "full_name": rop_full_name,
                    "role": "rop",
                    "organization_id": org["id"],
                },
            }
        ).user
    except Exception as err:
        admin.auth.admin.delete_user(admin_user.id)
        admin.table("organizations").delete().eq("id", org["id"]).execute()
        raise HTTPException(
            status_code=400, detail=str(err) or "Could not create the ROP account."
        ) from err

    return {"organizationId": org["id"], "adminId": admin_user.id, "ropId": rop_user.id}


class AddEmployeeBody(BaseModel):
    organization_id: str | None = None
    email: str | None = None
    password: str | None = None
    full_name: str | None = None
    role: str | None = None


@router.post("/platform/add-employee")
async def add_employee(body: AddEmployeeBody, authorization: str | None = Header(default=None)):
    await _require_owner(authorization)
    admin = get_supabase_admin()

    organization_id = (body.organization_id or "").strip()
    email = (body.email or "").strip()
    password = body.password
    full_name = (body.full_name or "").strip()
    role = body.role

    if not organization_id or not email or not password or len(password) < 8:
        raise HTTPException(
            status_code=400, detail="Company, email and an 8+ character password are required."
        )
    if not role or role not in _ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="A valid role is required.")

    org = (
        admin.table("organizations")
        .select("id")
        .eq("id", organization_id)
        .maybe_single()
        .execute()
        .data
    )
    if not org:
        raise HTTPException(status_code=404, detail="Company not found.")

    try:
        user = admin.auth.admin.create_user(
            {
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {
                    "full_name": full_name,
                    "role": role,
                    "organization_id": organization_id,
                },
            }
        ).user
    except Exception as err:
        raise HTTPException(
            status_code=400, detail=str(err) or "Could not create the account."
        ) from err
    return {"id": user.id}


class DeleteUserBody(BaseModel):
    id: str | None = None


@router.post("/platform/delete-user")
async def delete_user(body: DeleteUserBody, authorization: str | None = Header(default=None)):
    owner_id = await _require_owner(authorization)
    admin = get_supabase_admin()

    target_id = (body.id or "").strip()
    if not target_id:
        raise HTTPException(status_code=400, detail="User id is required.")
    if target_id == owner_id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account.")

    target = (
        admin.table("profiles").select("role").eq("id", target_id).maybe_single().execute().data
    )
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    if target["role"] == "platform_owner":
        raise HTTPException(status_code=400, detail="Platform owner accounts can't be deleted here.")

    try:
        admin.auth.admin.delete_user(target_id)
    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    return {"ok": True}


class UpdateUserBody(BaseModel):
    id: str | None = None
    full_name: str | None = None
    role: str | None = None
    password: str | None = None


@router.post("/platform/update-user")
async def update_user(body: UpdateUserBody, authorization: str | None = Header(default=None)):
    await _require_owner(authorization)
    admin = get_supabase_admin()

    target_id = (body.id or "").strip()
    if not target_id:
        raise HTTPException(status_code=400, detail="User id is required.")

    target = (
        admin.table("profiles")
        .select("role, organization_id, email")
        .eq("id", target_id)
        .maybe_single()
        .execute()
        .data
    )
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    if target["role"] == "platform_owner":
        raise HTTPException(status_code=400, detail="Platform owner accounts can't be edited here.")

    if body.role is not None and body.role not in _ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="A valid role is required.")
    if body.password is not None and len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    profile_patch: dict[str, str] = {}
    if body.full_name is not None:
        profile_patch["full_name"] = body.full_name.strip()
    if body.role is not None:
        profile_patch["role"] = body.role

    if profile_patch:
        try:
            admin.table("profiles").update(profile_patch).eq("id", target_id).execute()
        except Exception as err:
            raise HTTPException(status_code=400, detail=str(err)) from err

    if body.password:
        try:
            admin.auth.admin.update_user_by_id(target_id, {"password": body.password})
        except Exception as err:
            raise HTTPException(status_code=400, detail=str(err)) from err

        final_role = body.role or target["role"]
        if final_role == "super_admin" and target["organization_id"]:
            await sync_org_admin_credentials(
                target["organization_id"], target_id, target["email"], body.password
            )

    return {"ok": True}


@router.get("/platform/company-directory")
async def company_directory(authorization: str | None = Header(default=None)):
    """Backs the platform owner's "Kompaniyalar" switcher screen -- the
    screen an owner lands on right after logging in, before ever reaching a
    single company's data. Returns the owner's own profile plus, per
    organization: its employee count and its Super Admin's login/password
    (password is null when no organization_admin_credentials row exists
    yet, e.g. an org created before this feature or whose password has
    never been reset since)."""
    owner_id = await _require_owner(authorization)
    admin = get_supabase_admin()

    owner = (
        admin.table("profiles")
        .select("id, full_name, email")
        .eq("id", owner_id)
        .maybe_single()
        .execute()
        .data
        or {}
    )
    orgs = (
        admin.table("organizations")
        .select("id, name, active, plan, created_at")
        .order("created_at")
        .execute()
        .data
        or []
    )
    profiles = (
        admin.table("profiles")
        .select("id, organization_id, role, email")
        .not_.is_("organization_id", "null")
        .execute()
        .data
        or []
    )
    creds = admin.table("organization_admin_credentials").select("*").execute().data or []
    creds_by_org = {c["organization_id"]: c for c in creds}

    companies = []
    for org in orgs:
        org_profiles = [p for p in profiles if p["organization_id"] == org["id"]]
        super_admin = next((p for p in org_profiles if p["role"] == "super_admin"), None)
        cred = creds_by_org.get(org["id"])
        companies.append(
            {
                "id": org["id"],
                "name": org["name"],
                "active": org["active"],
                "plan": org["plan"],
                "createdAt": org["created_at"],
                "employeeCount": len(org_profiles),
                "superAdminId": super_admin["id"] if super_admin else None,
                "login": (super_admin or {}).get("email") or (cred or {}).get("super_admin_email"),
                "password": (cred or {}).get("super_admin_password_plaintext"),
            }
        )

    return {
        "owner": {
            "id": owner_id,
            "name": owner.get("full_name") or owner.get("email") or "",
            "email": owner.get("email") or "",
        },
        "companies": companies,
    }


@router.post("/platform/deactivate-expired-trials")
async def deactivate_expired_trials(authorization: str | None = Header(default=None)):
    """Lazily flips a company inactive once its trial has passed -- called
    from the Platform page on load rather than on a schedule, since the
    original has no cron dependency available there. Gated to the platform
    owner so it can't be triggered by an arbitrary signed-in user."""
    await _require_owner(authorization)
    admin = get_supabase_admin()
    try:
        admin.table("organizations").update({"active": False}).eq("active", True).not_.is_(
            "trial_ends_at", "null"
        ).lt("trial_ends_at", datetime.now(timezone.utc).isoformat()).execute()
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err)) from err
    return {"ok": True}


class DeleteOrganizationBody(BaseModel):
    id: str | None = None


@router.post("/platform/delete-organization")
async def delete_organization(
    body: DeleteOrganizationBody, authorization: str | None = Header(default=None)
):
    await _require_owner(authorization)
    admin = get_supabase_admin()

    org_id = (body.id or "").strip()
    if not org_id:
        raise HTTPException(status_code=400, detail="Company id is required.")

    org = admin.table("organizations").select("id").eq("id", org_id).maybe_single().execute().data
    if not org:
        raise HTTPException(status_code=404, detail="Company not found.")

    # Delete every member's auth account first (cascades to their profiles
    # row) via the same Auth Admin API path admin.delete-employee.ts
    # already uses -- proven, not raw SQL against the auth schema.
    members = (
        admin.table("profiles").select("id").eq("organization_id", org_id).execute().data or []
    )
    for member in members:
        try:
            admin.auth.admin.delete_user(member["id"])
        except Exception as err:
            raise HTTPException(
                status_code=400, detail=f"Failed to remove a company member: {err}"
            ) from err

    # Everything else (leads, deals, contacts, tasks, calls, audit trail,
    # settings, and finally the organization row itself) in one transaction
    # -- see the migration for why this can't just be a plain
    # `delete from organizations`.
    try:
        admin.rpc("delete_organization_data", {"target_org_id": org_id}).execute()
    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err)) from err

    return {"ok": True}
