-- Backs Lead Analytics' "Yo'nalish" tab (the last of the 4). Same
-- SQL-side-aggregation reasoning as the other three lead_analytics_* RPCs.
--
-- "Yo'nalish" (closing soon / neutral / losing soon) has no direct AmoCRM
-- field to read -- it's a heuristic combining two real signals this schema
-- does have: AI-derived temperature (see the score/temperature rollup from
-- the call-analysis pipeline) and how recently the lead was actually
-- contacted (last_contact_at, synced straight from AmoCRM). A hot lead
-- touched in the last 3 days reads as closing soon; a lead gone 14+ days
-- without contact (or that never had one) reads as losing soon; everything
-- else is neutral.
create or replace function public.lead_analytics_direction(
  p_funnel text default null,
  p_manager uuid default null
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_org uuid := public.current_user_org_id();
  v_direction jsonb;
  v_lost_reasons jsonb;
  v_churn_risk jsonb;
begin
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
    and (p_funnel is null or l.funnel = p_funnel)
    and (p_manager is null or l.owner_id = p_manager);

  select coalesce(jsonb_agg(row_to_json(t) order by t.count desc), '[]'::jsonb) into v_lost_reasons
  from (
    select coalesce(l.loss_reason, '—') as reason, count(*) as count
    from leads l
    join pipeline_stages s on s.id = l.stage_id
    where l.organization_id = v_org
      and s.is_lost
      and (p_funnel is null or l.funnel = p_funnel)
      and (p_manager is null or l.owner_id = p_manager)
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
      and (p_funnel is null or l.funnel = p_funnel)
      and (p_manager is null or l.owner_id = p_manager)
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

grant execute on function public.lead_analytics_direction(text, uuid) to authenticated;
