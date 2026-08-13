-- amocrm_connection had zero client-facing SELECT policies for an org's own
-- super_admin (only public.is_platform_owner() could read it) — so a sync
-- failure (last_sync_error) was invisible in the org-level Integrations
-- page no matter how many times an admin clicked "Sync now". This adds a
-- narrow SELECT policy so an org's own super_admin can see their own
-- connection's status/error, matching the "isAdmin" gate already used in
-- the Integrations UI. Client code must keep selecting only safe columns
-- (subdomain, timestamps, error) — RLS is row-level, not column-level, so
-- this does not itself hide access_token/refresh_token from a `select *`.

create or replace function public.current_user_org_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_role()
returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

drop policy if exists "amocrm_connection_select_admin" on public.amocrm_connection;
create policy "amocrm_connection_select_admin" on public.amocrm_connection
  for select to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.current_user_role() = 'super_admin'
  );
