-- ai_agents_select was widened to let the platform owner see any org's AI
-- agent config (20260812130000_owner_panel.sql), but ai_agents_write was
-- never touched to match -- it still requires the literal 'super_admin'
-- role, so a platform_owner account can open /admin/ai-agents (the page
-- gate and the select policy both allow it), see the real toggle/config
-- state, but every save silently fails the RLS check on the actual
-- update/insert with no useful error surfaced client-side.
drop policy if exists "ai_agents_write" on public.ai_agents;
create policy "ai_agents_write" on public.ai_agents for all to authenticated
  using (
    organization_id = public.current_user_org_id()
    and (public.current_user_role() = 'super_admin' or public.is_platform_owner())
  )
  with check (
    organization_id = public.current_user_org_id()
    and (public.current_user_role() = 'super_admin' or public.is_platform_owner())
  );
