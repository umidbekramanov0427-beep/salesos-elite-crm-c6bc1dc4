"""Port of src/lib/organization-admin-credentials.server.ts.

Keeps organization_admin_credentials in sync with the one super_admin
password Supabase Auth actually knows at any given moment. Auth only ever
stores a hash, never the plaintext, so this mirror exists solely for the
platform owner's company switcher (platform.company-directory.ts) to be
able to show/reveal it later. Called from every route that ever sets a
super_admin's password: platform.create-organization.ts,
platform.update-user.ts, admin.set-employee-password.ts.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.db import get_supabase_admin


async def sync_org_admin_credentials(
    organization_id: str, user_id: str, email: str, password: str
) -> None:
    admin = get_supabase_admin()
    admin.table("organization_admin_credentials").upsert(
        {
            "organization_id": organization_id,
            "super_admin_user_id": user_id,
            "super_admin_email": email,
            "super_admin_password_plaintext": password,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        on_conflict="organization_id",
    ).execute()
