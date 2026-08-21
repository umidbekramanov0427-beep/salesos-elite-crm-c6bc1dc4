-- The Voronkalar list cards showed a "conversion" computed as won/total (a
-- lifetime win-rate across every lead ever attributed to the funnel), while
-- the exact same word "konversiya" inside a funnel's detail view means
-- something else entirely: "late funnel conversion" -- what fraction of the
-- funnel's current leads have reached a late-stage/sales position
-- (prepayment/half-payment/full-payment/won), regardless of whether they've
-- actually closed. Two different numbers under the same label read as a
-- bug. Per instruction, the list cards now show the SAME late-funnel
-- conversion the detail view already computes -- same keyword list
-- (SALES_STAGE_KEYWORDS in use-crm-data.ts) and the same apostrophe-
-- stripping normalization (normalizeStageName), mirrored here in SQL since
-- this aggregate can't reuse client-side JS. Adds one column
-- (late_funnel); everything else in this function is untouched.
-- Adding a column changes the return type, which CREATE OR REPLACE FUNCTION
-- cannot do for an existing function -- must drop first.
DROP FUNCTION IF EXISTS public.funnel_list_stats();
CREATE OR REPLACE FUNCTION public.funnel_list_stats()
 RETURNS TABLE(funnel text, total bigint, value numeric, won bigint, late_funnel bigint, hot bigint, warm bigint, cold bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with scope as (
    select case
      when public.current_user_role() in ('super_admin', 'platform_owner') then null::uuid[]
      when public.current_user_role() = 'rop' then (
        select array_agg(id) from public.profiles
        where id = auth.uid() or manager_id = auth.uid()
      )
      else array[auth.uid()]
    end as owner_ids
  ),
  conn as (
    select enabled_pipeline_ids
    from public.amocrm_connection
    where organization_id = public.current_user_org_id()
  ),
  pipeline_map as (
    select distinct on (pipeline_name) pipeline_name, amocrm_pipeline_id
    from public.pipeline_stages
    where pipeline_name is not null and amocrm_pipeline_id is not null
    order by pipeline_name, amocrm_pipeline_id
  )
  select
    coalesce(nullif(l.funnel, ''), 'Direct Sales') as funnel,
    count(*) as total,
    coalesce(sum(l.expected_revenue), 0) as value,
    count(*) filter (where ps.is_won) as won,
    count(*) filter (
      where regexp_replace(lower(ps.name), '[''’ʼ`]', '', 'g')
        ~ '(predoplata|peredoplata|yarim|toliq|won|успешно|rop closed)'
    ) as late_funnel,
    count(*) filter (where l.temperature in ('Hot', 'VeryHot')) as hot,
    count(*) filter (where l.temperature = 'Warm') as warm,
    count(*) filter (where l.temperature = 'Cold') as cold
  from public.leads l
  cross join scope
  left join conn on true
  left join pipeline_map pm on pm.pipeline_name = l.funnel
  left join public.pipeline_stages ps on ps.id = l.stage_id
  where l.organization_id = public.current_user_org_id()
    and (scope.owner_ids is null or l.owner_id = any(scope.owner_ids))
    and (
      conn.enabled_pipeline_ids is null
      or pm.amocrm_pipeline_id is null
      or pm.amocrm_pipeline_id = any(conn.enabled_pipeline_ids)
    )
  group by 1;
$function$
