-- Live inspection (pg_policies) confirmed the "organizations" table has RLS
-- enabled but literally zero policies on it -- the two policies from
-- 20260811050000_organizations.sql (organizations_select/organizations_write)
-- never actually got created on this database, even though the table,
-- columns, and every later migration referencing it clearly did apply.
-- With RLS on and no policy, every client-side select returns zero rows for
-- everyone, including the platform owner -- this is exactly why the
-- Platform panel's company list, the Users page's "Kompaniyalar" column, and
-- the Integrations page (all of which read from public.organizations, or
-- join to it) showed empty/blank despite the underlying data existing.
drop policy if exists "organizations_select" on public.organizations;
create policy "organizations_select" on public.organizations
  for select to authenticated
  using (public.is_platform_owner() or id = public.current_user_org_id());

drop policy if exists "organizations_write" on public.organizations;
create policy "organizations_write" on public.organizations
  for all to authenticated
  using (public.is_platform_owner())
  with check (public.is_platform_owner());
