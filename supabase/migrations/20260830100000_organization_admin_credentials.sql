-- Platform-owner-only mirror of each organization's Super Admin login,
-- backing the owner's "Kompaniyalar" switcher screen (shown right after an
-- owner login) where the owner can reveal a company's actual super_admin
-- password to log straight into it. Supabase Auth hashes passwords
-- irreversibly -- there is no way to recover an existing one -- so this is
-- the one deliberate place the plaintext is mirrored, written only by the
-- three service-role routes that ever set a super_admin's password
-- (platform/create-organization, platform/update-user,
-- admin/set-employee-password). RLS is enabled with no policies at all:
-- every access goes through supabaseAdmin server-side, never a client
-- PostgREST call, so no authenticated role can read or write this table.
create table if not exists public.organization_admin_credentials (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  super_admin_user_id uuid not null,
  super_admin_email text not null,
  super_admin_password_plaintext text not null,
  updated_at timestamptz not null default now()
);

alter table public.organization_admin_credentials enable row level security;
