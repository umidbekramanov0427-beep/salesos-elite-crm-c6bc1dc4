-- Backs the new Lead Analytics "Harakat kerak" tab. Runs entirely in SQL
-- (not client-side reduction over useLeadsRaw()) since this org has tens of
-- thousands of leads -- same reasoning as funnel_list_stats/dashboard_kpis/
-- leaderboard_stats from the earlier perf pass. p_funnel/p_manager are
-- optional filters (null = no restriction); p_since restricts "jami lidlar"
-- to leads created at/after that timestamp (null = all-time).
create or replace function public.lead_analytics_action(
  p_funnel text default null,
  p_manager uuid default null,
  p_since timestamptz default null
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_org uuid := public.current_user_org_id();
  v_total_leads int;
  v_won int;
  v_lost int;
  v_hot int;
  v_churn int;
  v_recoverable jsonb;
  v_hot_pipeline jsonb;
  v_operator_activity jsonb;
begin
  select count(*) into v_total_leads
  from leads l
  where l.organization_id = v_org
    and (p_funnel is null or l.funnel = p_funnel)
    and (p_manager is null or l.owner_id = p_manager)
    and (p_since is null or l.created_at >= p_since);

  select
    count(*) filter (where s.is_won),
    count(*) filter (where s.is_lost)
  into v_won, v_lost
  from leads l
  join pipeline_stages s on s.id = l.stage_id
  where l.organization_id = v_org
    and (p_funnel is null or l.funnel = p_funnel)
    and (p_manager is null or l.owner_id = p_manager);

  select count(*) into v_hot
  from leads l
  join pipeline_stages s on s.id = l.stage_id
  where l.organization_id = v_org
    and not s.is_won and not s.is_lost
    and l.temperature in ('Hot', 'VeryHot')
    and (p_funnel is null or l.funnel = p_funnel)
    and (p_manager is null or l.owner_id = p_manager);

  select count(*) into v_churn
  from leads l
  join pipeline_stages s on s.id = l.stage_id
  where l.organization_id = v_org
    and not s.is_won and not s.is_lost
    and (l.last_contact_at is null or l.last_contact_at < now() - interval '7 days')
    and (p_funnel is null or l.funnel = p_funnel)
    and (p_manager is null or l.owner_id = p_manager);

  -- "Qaytarilishi mumkin lost lidlar" -- most recently lost first, so the
  -- freshest losses (still worth a second try) surface before ones long cold.
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_recoverable
  from (
    select
      l.id as lead_id,
      l.name,
      coalesce(p.full_name, '—') as manager,
      extract(day from now() - l.updated_at)::int as days_since_closed,
      l.next_follow_up
    from leads l
    join pipeline_stages s on s.id = l.stage_id
    left join profiles p on p.id = l.owner_id
    where l.organization_id = v_org
      and s.is_lost
      and (p_funnel is null or l.funnel = p_funnel)
      and (p_manager is null or l.owner_id = p_manager)
    order by l.updated_at desc
    limit 20
  ) t;

  -- "Bugun yopish mumkin" -- open leads, hottest/highest-scored first.
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_hot_pipeline
  from (
    select
      l.id as lead_id,
      l.name,
      coalesce(p.full_name, '—') as manager,
      l.score,
      l.temperature,
      s.name as stage,
      l.expected_revenue as value
    from leads l
    join pipeline_stages s on s.id = l.stage_id
    left join profiles p on p.id = l.owner_id
    where l.organization_id = v_org
      and not s.is_won and not s.is_lost
      and l.temperature in ('Hot', 'VeryHot')
      and (p_funnel is null or l.funnel = p_funnel)
      and (p_manager is null or l.owner_id = p_manager)
    order by l.score desc, l.expected_revenue desc
    limit 20
  ) t;

  -- "Operator bo'yicha aktivlik" -- last 3h of calls, per owning manager,
  -- split by the lead's current stage (won/lost; open leads excluded, same
  -- as the reference tool's own legend which only names Yutilgan/Yo'qotilgan)
  -- and whether that specific call connected.
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_operator_activity
  from (
    select
      coalesce(p.full_name, '—') as manager,
      count(*) filter (where s.is_won and c.connected) as won_connected,
      count(*) filter (where s.is_won and not c.connected) as won_attempts,
      count(*) filter (where s.is_lost and c.connected) as lost_connected,
      count(*) filter (where s.is_lost and not c.connected) as lost_attempts
    from amocrm_calls c
    join leads l on l.id = c.lead_id
    join pipeline_stages s on s.id = l.stage_id
    left join profiles p on p.id = l.owner_id
    where l.organization_id = v_org
      and c.occurred_at >= now() - interval '3 hours'
      and (s.is_won or s.is_lost)
      and (p_funnel is null or l.funnel = p_funnel)
      and (p_manager is null or l.owner_id = p_manager)
    group by coalesce(p.full_name, '—')
    order by count(*) desc
    limit 20
  ) t;

  return jsonb_build_object(
    'totalLeads', v_total_leads,
    'avgConversion', case when (v_won + v_lost) > 0 then round((v_won::numeric / (v_won + v_lost)) * 100, 1) else 0 end,
    'hotLeads', v_hot,
    'churnRisk', v_churn,
    'recoverable', v_recoverable,
    'hotPipeline', v_hot_pipeline,
    'operatorActivity', v_operator_activity
  );
end;
$$;

grant execute on function public.lead_analytics_action(text, uuid, timestamptz) to authenticated;
