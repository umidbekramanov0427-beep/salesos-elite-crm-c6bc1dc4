-- Owner (Platform) panel: richer company records (phone/plan/trial) and
-- read-only, platform-wide visibility for platform_owner across the
-- tables that were previously scoped strictly to a single organization
-- (or service-role only). Write access to a company's own data is
-- unchanged — this only adds READ visibility for the platform operator.

alter table public.organizations
  add column if not exists phone text,
  add column if not exists plan text not null default 'Basic',
  add column if not exists trial_ends_at timestamptz;

-- profiles: owner needs to list users across every company (previously
-- could only see their own row, since organization_id is null for them).
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or (public.is_admin_or_manager() and organization_id = public.current_user_org_id())
    or public.is_platform_owner()
  );

-- audit_logs: owner needs the platform-wide activity trail.
drop policy if exists "audit_logs_select" on public.audit_logs;
create policy "audit_logs_select" on public.audit_logs for select to authenticated
  using (
    (organization_id = public.current_user_org_id() and public.is_admin_or_manager())
    or public.is_platform_owner()
  );

-- amocrm_connection: had zero client-facing policies (service-role only).
-- Add a read-only one for the owner's integrations overview; writes still
-- go through supabaseAdmin server routes only.
drop policy if exists "amocrm_connection_select_owner" on public.amocrm_connection;
create policy "amocrm_connection_select_owner" on public.amocrm_connection
  for select to authenticated
  using (public.is_platform_owner());

-- ai_agents: owner needs a read-only cross-org overview alongside each
-- company's own super_admin access.
drop policy if exists "ai_agents_select" on public.ai_agents;
create policy "ai_agents_select" on public.ai_agents for select to authenticated
  using (
    (organization_id = public.current_user_org_id() and public.current_user_role() = 'super_admin')
    or public.is_platform_owner()
  );

-- Trial expiry is enforced from a service-role server route
-- (POST /platform/deactivate-expired-trials, requirePlatformOwner-gated),
-- not a client-callable RPC — a plain update statement there is simpler
-- and doesn't need a SECURITY DEFINER function grantable to `authenticated`,
-- which any signed-in user (not just the owner) could otherwise invoke.
