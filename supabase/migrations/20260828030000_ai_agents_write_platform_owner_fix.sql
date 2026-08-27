-- The previous migration (20260828020000) tried to let a platform_owner
-- save AI agent config for any org, but wrote the org check as a global
-- AND across both branches:
--   organization_id = current_user_org_id() and (role = 'super_admin' or is_platform_owner())
-- That still requires the platform owner's OWN organization_id to match
-- the org being edited -- which almost never holds, since the whole point
-- of the owner-panel access is managing a *different* org's settings. The
-- select policy (20260812130000_owner_panel.sql) already has the right
-- shape: the org match only guards the super_admin branch, and
-- is_platform_owner() stands on its own. Re-create write to match exactly.
drop policy if exists "ai_agents_write" on public.ai_agents;
create policy "ai_agents_write" on public.ai_agents for all to authenticated
  using (
    (organization_id = public.current_user_org_id() and public.current_user_role() = 'super_admin')
    or public.is_platform_owner()
  )
  with check (
    (organization_id = public.current_user_org_id() and public.current_user_role() = 'super_admin')
    or public.is_platform_owner()
  );
