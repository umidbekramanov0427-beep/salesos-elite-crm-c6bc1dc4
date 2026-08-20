-- Backs Lead Analytics' "Hozirgi holat" tab. Same reasoning as the other
-- two lead_analytics_* RPCs: this org's lead table is too large for
-- client-side reduction.
create or replace function public.lead_analytics_current(
  p_funnel text default null,
  p_manager uuid default null
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_org uuid := public.current_user_org_id();
  v_temperature jsonb;
  v_stages jsonb;
  v_manager_load jsonb;
begin
  -- "Lead harorat taqsimoti" -- open leads only, since a closed lead's
  -- temperature is a historical artifact, not something to act on today.
  select jsonb_build_object(
    'cold', count(*) filter (where l.temperature = 'Cold'),
    'warm', count(*) filter (where l.temperature = 'Warm'),
    'hot', count(*) filter (where l.temperature = 'Hot'),
    'veryHot', count(*) filter (where l.temperature = 'VeryHot')
  ) into v_temperature
  from leads l
  join pipeline_stages s on s.id = l.stage_id
  where l.organization_id = v_org
    and not s.is_won and not s.is_lost
    and (p_funnel is null or l.funnel = p_funnel)
    and (p_manager is null or l.owner_id = p_manager);

  -- "Bosqichlar va kechikish" -- per stage: how many leads sit there now,
  -- and on average how many days since each was last touched (a real,
  -- if approximate, stand-in for "time in stage" -- this schema has no
  -- per-stage-entry timestamp to compute the exact figure from).
  select coalesce(jsonb_agg(row_to_json(t) order by t.lead_count desc), '[]'::jsonb) into v_stages
  from (
    select
      s.name as stage,
      count(l.id) as lead_count,
      round(avg(extract(epoch from now() - l.updated_at) / 86400), 1) as avg_days
    from pipeline_stages s
    left join leads l
      on l.stage_id = s.id
      and l.organization_id = v_org
      and (p_funnel is null or l.funnel = p_funnel)
      and (p_manager is null or l.owner_id = p_manager)
    where s.organization_id = v_org
      and (p_funnel is null or s.pipeline_name = p_funnel)
    group by s.id, s.name
    having count(l.id) > 0
    limit 20
  ) t;

  -- "Menejer bo'yicha yuklama" -- open leads per manager, split by
  -- temperature.
  select coalesce(jsonb_agg(row_to_json(t) order by t.total desc), '[]'::jsonb) into v_manager_load
  from (
    select
      coalesce(p.full_name, '—') as manager,
      count(*) filter (where l.temperature = 'Cold') as cold,
      count(*) filter (where l.temperature = 'Warm') as warm,
      count(*) filter (where l.temperature = 'Hot') as hot,
      count(*) filter (where l.temperature = 'VeryHot') as very_hot,
      count(*) as total
    from leads l
    join pipeline_stages s on s.id = l.stage_id
    left join profiles p on p.id = l.owner_id
    where l.organization_id = v_org
      and not s.is_won and not s.is_lost
      and (p_funnel is null or l.funnel = p_funnel)
      and (p_manager is null or l.owner_id = p_manager)
    group by coalesce(p.full_name, '—')
    order by count(*) desc
    limit 25
  ) t;

  return jsonb_build_object(
    'temperature', v_temperature,
    'stages', v_stages,
    'managerLoad', v_manager_load
  );
end;
$$;

grant execute on function public.lead_analytics_current(text, uuid) to authenticated;
