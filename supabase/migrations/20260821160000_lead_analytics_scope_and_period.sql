-- Lead Analytics had two confirmed bugs:
--
-- 1. No owner/role scoping at all: every one of the 4 RPCs only filtered by
--    organization_id, so any authenticated user (including a plain rep)
--    could see the whole company's leads on this page -- unlike every other
--    page (Dashboard, Funnels, AmoCRM board), which scope to the caller's
--    own/team data for non-admin roles. p_manager/p_team were optional,
--    client-supplied narrowing filters only -- not an enforced boundary, and
--    a rep could pass any other manager's/team's id and see their data too.
--    Fixed by adding the same `scope` owner_ids computation already used by
--    funnel_list_stats (super_admin/platform_owner -> unrestricted, rop ->
--    self + direct reports via manager_id, everyone else -> self only),
--    applied as a hard filter ANDed with the existing funnel/manager/team
--    filters in every leads-touching query.
--
-- 2. The Kunlik/Oylik period filter (p_since) only existed as a parameter on
--    lead_analytics_action, and even there it was only applied to the
--    "Jami lidlar" total -- the other 6 metrics in that function ignored it,
--    and the other 3 RPCs (quality/current/direction, ~13 more widgets)
--    had no p_since parameter at all. Fixed by adding p_since to all 4
--    functions and applying it to every leads-based subquery. The one
--    exception left alone on purpose: lead_analytics_action's operator
--    activity table is a real-time "who's on calls right now" widget on a
--    fixed last-3-hours window, not a historical count -- applying the
--    selected period there would change its meaning, so only owner scoping
--    was added to it, not p_since.
--
-- Parameter lists change (new p_since on 3 of the 4 functions), so each is
-- dropped and recreated in full, same approach as the team-filter migration
-- this one supersedes.

drop function if exists public.lead_analytics_action(text, uuid, timestamptz, uuid);
create or replace function public.lead_analytics_action(
  p_funnel text default null,
  p_manager uuid default null,
  p_since timestamptz default null,
  p_team uuid default null
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_org uuid := public.current_user_org_id();
  v_scope_owner_ids uuid[];
  v_total_leads int;
  v_won int;
  v_lost int;
  v_hot int;
  v_churn int;
  v_recoverable jsonb;
  v_hot_pipeline jsonb;
  v_operator_activity jsonb;
begin
  select case
    when public.current_user_role() in ('super_admin', 'platform_owner') then null::uuid[]
    when public.current_user_role() = 'rop' then (
      select array_agg(id) from public.profiles
      where id = auth.uid() or manager_id = auth.uid()
    )
    else array[auth.uid()]
  end into v_scope_owner_ids;

  select count(*) into v_total_leads
  from leads l
  where l.organization_id = v_org
    and (v_scope_owner_ids is null or l.owner_id = any(v_scope_owner_ids))
    and (p_funnel is null or l.funnel = p_funnel)
    and (p_manager is null or l.owner_id = p_manager)
    and (p_team is null or l.owner_id = p_team or l.owner_id in (select id from profiles where manager_id = p_team))
    and (p_since is null or l.created_at >= p_since);

  select
    count(*) filter (where s.is_won),
    count(*) filter (where s.is_lost)
  into v_won, v_lost
  from leads l
  join pipeline_stages s on s.id = l.stage_id
  where l.organization_id = v_org
    and (v_scope_owner_ids is null or l.owner_id = any(v_scope_owner_ids))
    and (p_funnel is null or l.funnel = p_funnel)
    and (p_manager is null or l.owner_id = p_manager)
    and (p_team is null or l.owner_id = p_team or l.owner_id in (select id from profiles where manager_id = p_team))
    and (p_since is null or l.created_at >= p_since);

  select count(*) into v_hot
  from leads l
  join pipeline_stages s on s.id = l.stage_id
  where l.organization_id = v_org
    and not s.is_won and not s.is_lost
    and l.temperature in ('Hot', 'VeryHot')
    and (v_scope_owner_ids is null or l.owner_id = any(v_scope_owner_ids))
    and (p_funnel is null or l.funnel = p_funnel)
    and (p_manager is null or l.owner_id = p_manager)
    and (p_team is null or l.owner_id = p_team or l.owner_id in (select id from profiles where manager_id = p_team))
    and (p_since is null or l.created_at >= p_since);

  select count(*) into v_churn
  from leads l
  join pipeline_stages s on s.id = l.stage_id
  where l.organization_id = v_org
    and not s.is_won and not s.is_lost
    and (l.last_contact_at is null or l.last_contact_at < now() - interval '7 days')
    and (v_scope_owner_ids is null or l.owner_id = any(v_scope_owner_ids))
    and (p_funnel is null or l.funnel = p_funnel)
    and (p_manager is null or l.owner_id = p_manager)
    and (p_team is null or l.owner_id = p_team or l.owner_id in (select id from profiles where manager_id = p_team))
    and (p_since is null or l.created_at >= p_since);

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
      and (v_scope_owner_ids is null or l.owner_id = any(v_scope_owner_ids))
      and (p_funnel is null or l.funnel = p_funnel)
      and (p_manager is null or l.owner_id = p_manager)
      and (p_team is null or l.owner_id = p_team or l.owner_id in (select id from profiles where manager_id = p_team))
      and (p_since is null or l.created_at >= p_since)
    order by l.updated_at desc
    limit 20
  ) t;

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
      and (v_scope_owner_ids is null or l.owner_id = any(v_scope_owner_ids))
      and (p_funnel is null or l.funnel = p_funnel)
      and (p_manager is null or l.owner_id = p_manager)
      and (p_team is null or l.owner_id = p_team or l.owner_id in (select id from profiles where manager_id = p_team))
      and (p_since is null or l.created_at >= p_since)
    order by l.score desc, l.expected_revenue desc
    limit 20
  ) t;

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
      and (v_scope_owner_ids is null or l.owner_id = any(v_scope_owner_ids))
      and (p_funnel is null or l.funnel = p_funnel)
      and (p_manager is null or l.owner_id = p_manager)
      and (p_team is null or l.owner_id = p_team or l.owner_id in (select id from profiles where manager_id = p_team))
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
grant execute on function public.lead_analytics_action(text, uuid, timestamptz, uuid) to authenticated;


drop function if exists public.lead_analytics_quality(text, uuid, uuid);
create or replace function public.lead_analytics_quality(
  p_funnel text default null,
  p_manager uuid default null,
  p_team uuid default null,
  p_since timestamptz default null
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_org uuid := public.current_user_org_id();
  v_scope_owner_ids uuid[];
  v_tag_results jsonb;
  v_tag_matrix jsonb;
  v_tag_categories jsonb;
begin
  select case
    when public.current_user_role() in ('super_admin', 'platform_owner') then null::uuid[]
    when public.current_user_role() = 'rop' then (
      select array_agg(id) from public.profiles
      where id = auth.uid() or manager_id = auth.uid()
    )
    else array[auth.uid()]
  end into v_scope_owner_ids;

  select coalesce(jsonb_agg(row_to_json(t) order by t.total desc), '[]'::jsonb) into v_tag_results
  from (
    select
      tag,
      count(*) filter (where s.is_won) as sold,
      count(*) filter (where s.is_lost) as lost,
      count(*) filter (where not s.is_won and not s.is_lost) as open,
      count(*) as total
    from leads l
    join pipeline_stages s on s.id = l.stage_id
    cross join lateral unnest(l.tags) as tag
    where l.organization_id = v_org
      and (v_scope_owner_ids is null or l.owner_id = any(v_scope_owner_ids))
      and (p_funnel is null or l.funnel = p_funnel)
      and (p_manager is null or l.owner_id = p_manager)
      and (p_team is null or l.owner_id = p_team or l.owner_id in (select id from profiles where manager_id = p_team))
      and (p_since is null or l.created_at >= p_since)
    group by tag
    order by count(*) desc
    limit 15
  ) t;

  select coalesce(jsonb_agg(row_to_json(t) order by t.total desc), '[]'::jsonb) into v_tag_matrix
  from (
    select
      tag,
      count(*) as total,
      round(avg(l.score), 1) as avg_score,
      round(
        (count(*) filter (where s.is_won))::numeric
        / nullif(count(*) filter (where s.is_won or s.is_lost), 0) * 100,
        1
      ) as conversion,
      count(*) < 10 as low_sample
    from leads l
    join pipeline_stages s on s.id = l.stage_id
    cross join lateral unnest(l.tags) as tag
    where l.organization_id = v_org
      and (v_scope_owner_ids is null or l.owner_id = any(v_scope_owner_ids))
      and (p_funnel is null or l.funnel = p_funnel)
      and (p_manager is null or l.owner_id = p_manager)
      and (p_team is null or l.owner_id = p_team or l.owner_id in (select id from profiles where manager_id = p_team))
      and (p_since is null or l.created_at >= p_since)
    group by tag
    order by count(*) desc
    limit 15
  ) t;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_tag_categories
  from (
    select
      tag,
      count(*) filter (where l.temperature = 'Cold') as cold,
      count(*) filter (where l.temperature = 'Warm') as warm,
      count(*) filter (where l.temperature = 'Hot') as hot,
      count(*) filter (where l.temperature = 'VeryHot') as very_hot
    from leads l
    cross join lateral unnest(l.tags) as tag
    where l.organization_id = v_org
      and (v_scope_owner_ids is null or l.owner_id = any(v_scope_owner_ids))
      and (p_funnel is null or l.funnel = p_funnel)
      and (p_manager is null or l.owner_id = p_manager)
      and (p_team is null or l.owner_id = p_team or l.owner_id in (select id from profiles where manager_id = p_team))
      and (p_since is null or l.created_at >= p_since)
    group by tag
    order by count(*) desc
    limit 10
  ) t;

  return jsonb_build_object(
    'tagResults', v_tag_results,
    'tagMatrix', v_tag_matrix,
    'tagCategories', v_tag_categories
  );
end;
$$;
grant execute on function public.lead_analytics_quality(text, uuid, uuid, timestamptz) to authenticated;


drop function if exists public.lead_analytics_current(text, uuid, uuid);
create or replace function public.lead_analytics_current(
  p_funnel text default null,
  p_manager uuid default null,
  p_team uuid default null,
  p_since timestamptz default null
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_org uuid := public.current_user_org_id();
  v_scope_owner_ids uuid[];
  v_temperature jsonb;
  v_stages jsonb;
  v_manager_load jsonb;
begin
  select case
    when public.current_user_role() in ('super_admin', 'platform_owner') then null::uuid[]
    when public.current_user_role() = 'rop' then (
      select array_agg(id) from public.profiles
      where id = auth.uid() or manager_id = auth.uid()
    )
    else array[auth.uid()]
  end into v_scope_owner_ids;

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
    and (v_scope_owner_ids is null or l.owner_id = any(v_scope_owner_ids))
    and (p_funnel is null or l.funnel = p_funnel)
    and (p_manager is null or l.owner_id = p_manager)
    and (p_team is null or l.owner_id = p_team or l.owner_id in (select id from profiles where manager_id = p_team))
    and (p_since is null or l.created_at >= p_since);

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
      and (v_scope_owner_ids is null or l.owner_id = any(v_scope_owner_ids))
      and (p_funnel is null or l.funnel = p_funnel)
      and (p_manager is null or l.owner_id = p_manager)
      and (p_team is null or l.owner_id = p_team or l.owner_id in (select id from profiles where manager_id = p_team))
      and (p_since is null or l.created_at >= p_since)
    where s.organization_id = v_org
      and (p_funnel is null or s.pipeline_name = p_funnel)
    group by s.id, s.name
    having count(l.id) > 0
    limit 20
  ) t;

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
      and (v_scope_owner_ids is null or l.owner_id = any(v_scope_owner_ids))
      and (p_funnel is null or l.funnel = p_funnel)
      and (p_manager is null or l.owner_id = p_manager)
      and (p_team is null or l.owner_id = p_team or l.owner_id in (select id from profiles where manager_id = p_team))
      and (p_since is null or l.created_at >= p_since)
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
grant execute on function public.lead_analytics_current(text, uuid, uuid, timestamptz) to authenticated;


drop function if exists public.lead_analytics_direction(text, uuid, uuid);
create or replace function public.lead_analytics_direction(
  p_funnel text default null,
  p_manager uuid default null,
  p_team uuid default null,
  p_since timestamptz default null
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_org uuid := public.current_user_org_id();
  v_scope_owner_ids uuid[];
  v_direction jsonb;
  v_lost_reasons jsonb;
  v_churn_risk jsonb;
begin
  select case
    when public.current_user_role() in ('super_admin', 'platform_owner') then null::uuid[]
    when public.current_user_role() = 'rop' then (
      select array_agg(id) from public.profiles
      where id = auth.uid() or manager_id = auth.uid()
    )
    else array[auth.uid()]
  end into v_scope_owner_ids;

  select jsonb_build_object(
    'closingSoon', count(*) filter (
      where l.temperature in ('Hot', 'VeryHot') and l.last_contact_at >= now() - interval '3 days'
    ),
    'losingSoon', count(*) filter (
      where l.last_contact_at is null or l.last_contact_at < now() - interval '14 days'
    ),
    'neutral', count(*) filter (
      where not (l.temperature in ('Hot', 'VeryHot') and l.last_contact_at >= now() - interval '3 days')
        and not (l.last_contact_at is null or l.last_contact_at < now() - interval '14 days')
    )
  ) into v_direction
  from leads l
  join pipeline_stages s on s.id = l.stage_id
  where l.organization_id = v_org
    and not s.is_won and not s.is_lost
    and (v_scope_owner_ids is null or l.owner_id = any(v_scope_owner_ids))
    and (p_funnel is null or l.funnel = p_funnel)
    and (p_manager is null or l.owner_id = p_manager)
    and (p_team is null or l.owner_id = p_team or l.owner_id in (select id from profiles where manager_id = p_team))
    and (p_since is null or l.created_at >= p_since);

  select coalesce(jsonb_agg(row_to_json(t) order by t.count desc), '[]'::jsonb) into v_lost_reasons
  from (
    select coalesce(l.loss_reason, '—') as reason, count(*) as count
    from leads l
    join pipeline_stages s on s.id = l.stage_id
    where l.organization_id = v_org
      and s.is_lost
      and (v_scope_owner_ids is null or l.owner_id = any(v_scope_owner_ids))
      and (p_funnel is null or l.funnel = p_funnel)
      and (p_manager is null or l.owner_id = p_manager)
      and (p_team is null or l.owner_id = p_team or l.owner_id in (select id from profiles where manager_id = p_team))
      and (p_since is null or l.created_at >= p_since)
    group by coalesce(l.loss_reason, '—')
    order by count(*) desc
    limit 10
  ) t;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_churn_risk
  from (
    select
      l.id as lead_id,
      l.name,
      coalesce(p.full_name, '—') as manager,
      case
        when l.last_contact_at is null then null
        else extract(day from now() - l.last_contact_at)::int
      end as days_since_contact,
      least(
        100,
        round(
          coalesce(extract(epoch from now() - l.last_contact_at) / 86400, 30) / 30 * 100
        )
      )::int as risk_percent,
      l.score,
      l.temperature
    from leads l
    join pipeline_stages s on s.id = l.stage_id
    left join profiles p on p.id = l.owner_id
    where l.organization_id = v_org
      and not s.is_won and not s.is_lost
      and (l.last_contact_at is null or l.last_contact_at < now() - interval '7 days')
      and (v_scope_owner_ids is null or l.owner_id = any(v_scope_owner_ids))
      and (p_funnel is null or l.funnel = p_funnel)
      and (p_manager is null or l.owner_id = p_manager)
      and (p_team is null or l.owner_id = p_team or l.owner_id in (select id from profiles where manager_id = p_team))
      and (p_since is null or l.created_at >= p_since)
    order by (l.last_contact_at is null) desc, l.last_contact_at asc
    limit 15
  ) t;

  return jsonb_build_object(
    'direction', v_direction,
    'lostReasons', v_lost_reasons,
    'churnRisk', v_churn_risk
  );
end;
$$;
grant execute on function public.lead_analytics_direction(text, uuid, uuid, timestamptz) to authenticated;
