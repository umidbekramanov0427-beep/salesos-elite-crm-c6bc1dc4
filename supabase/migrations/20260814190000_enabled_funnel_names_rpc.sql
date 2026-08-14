-- Exposes which funnel (pipeline) names are enabled for import, without
-- granting broad SELECT on amocrm_connection (which still only super_admin
-- can read directly, since it also holds access_token/refresh_token). Every
-- funnel filter in the app (Reyting, Funnels, AmoCRM board, sidebar,
-- Dashboard) calls this RPC so a disabled/"not imported" pipeline never
-- appears as a filter option anywhere, for any role. Returns NULL when the
-- org has no selective-sync restriction configured (enabled_pipeline_ids is
-- NULL, i.e. "sync everything") -- callers treat NULL as "no restriction".
create or replace function public.enabled_funnel_names()
returns text[]
language sql stable security definer set search_path = public as $$
  select (
    select array_agg(distinct coalesce(ps.pipeline_name, 'Direct Sales'))
    from public.pipeline_stages ps
    where ps.organization_id = conn.organization_id
      and ps.amocrm_pipeline_id = any(conn.enabled_pipeline_ids)
  )
  from public.amocrm_connection conn
  where conn.organization_id = public.current_user_org_id()
    and conn.enabled_pipeline_ids is not null
  limit 1;
$$;

grant execute on function public.enabled_funnel_names() to authenticated;
