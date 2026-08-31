-- dashboard_kpis previously sourced revenue_today/revenue_month/won_this_week/
-- lost_this_week from the `deals` table, and mixed `deals` (numerator) with
-- `leads` (denominator) for `conversion`. In this AmoCRM-synced setup, `deals`
-- is never populated at all (AmoCRM has no separate "deal" entity -- a lead
-- IS the deal), so those four KPIs were always 0/near-0 regardless of real
-- pipeline activity, and conversion was comparing two unrelated counts.
--
-- Fix: compute every KPI from `leads` + `pipeline_stages.is_won/is_lost`,
-- the same pattern already used correctly by lead_analytics_action and the
-- daily-report generator (l.updated_at as the "moved to this stage" proxy,
-- since leads has no dedicated close_date column). Return shape (column
-- names/types) is unchanged, so no application code needs to change.
create or replace function public.dashboard_kpis(
  p_from timestamp with time zone default null,
  p_to timestamp with time zone default null,
  p_funnel text default null,
  p_min_amount numeric default null,
  p_max_amount numeric default null
)
returns table(
  revenue_today numeric,
  revenue_month numeric,
  pipeline_value numeric,
  open_deals_count bigint,
  new_leads_today bigint,
  won_this_week bigint,
  lost_this_week bigint,
  conversion numeric
)
language sql
stable
set search_path to 'public'
as $function$
  with scope as (
    select
      case
        when public.current_user_role() in ('super_admin', 'platform_owner') then null
        when public.current_user_role() = 'rop' then (
          select array_agg(id) from (
            select auth.uid() as id
            union
            select p.id from public.profiles p where p.manager_id = auth.uid()
          ) ids
        )
        else array[auth.uid()]
      end as owner_ids
  ),
  lead_rows as (
    select l.expected_revenue, l.created_at, l.updated_at, s.is_won, s.is_lost
    from public.leads l
    cross join scope
    left join public.pipeline_stages s on s.id = l.stage_id
    where l.organization_id = public.current_user_org_id()
      and (scope.owner_ids is null or l.owner_id = any(scope.owner_ids))
      and (p_from is null or l.created_at >= p_from)
      and (p_to is null or l.created_at <= p_to)
      and (p_funnel is null or coalesce(l.funnel, 'Direct Sales') = p_funnel)
      and (p_min_amount is null or l.expected_revenue >= p_min_amount)
      and (p_max_amount is null or l.expected_revenue <= p_max_amount)
  ),
  open_leads as (
    select expected_revenue
    from lead_rows
    where not coalesce(is_won, false) and not coalesce(is_lost, false)
  ),
  won_leads as (
    select expected_revenue from lead_rows where coalesce(is_won, false)
  )
  select
    coalesce(
      (select sum(expected_revenue) from lead_rows
        where coalesce(is_won, false) and updated_at >= date_trunc('day', now())),
      0
    ) as revenue_today,
    coalesce(
      (select sum(expected_revenue) from lead_rows
        where coalesce(is_won, false) and updated_at >= date_trunc('month', now())),
      0
    ) as revenue_month,
    round(
      (select count(*) from open_leads)
      * 0.15
      * coalesce(
          case
            when (select count(*) from won_leads) > 0 then (select avg(expected_revenue) from won_leads)
            else (select avg(expected_revenue) from open_leads)
          end,
          0
        )
    ) as pipeline_value,
    (select count(*) from open_leads) as open_deals_count,
    (select count(*) from lead_rows where created_at >= date_trunc('day', now())) as new_leads_today,
    (select count(*) from lead_rows
      where coalesce(is_won, false) and updated_at >= now() - interval '7 days') as won_this_week,
    (select count(*) from lead_rows
      where coalesce(is_lost, false) and updated_at >= now() - interval '7 days') as lost_this_week,
    case
      when (select count(*) from lead_rows) > 0
        then (select count(*) from lead_rows where coalesce(is_won, false))::numeric
             / (select count(*) from lead_rows) * 100
      else 0
    end as conversion;
$function$;
