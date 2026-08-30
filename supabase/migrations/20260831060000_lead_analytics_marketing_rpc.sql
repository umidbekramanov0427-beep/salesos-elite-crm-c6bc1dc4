-- Marketing tab for Lid tahlili: leads.source/campaign/utm have existed
-- since the very first schema but nothing in the app ever read them --
-- this is the first real "which channel is actually working" view.
-- Follows the exact same shape as the other 4 lead_analytics_* RPCs
-- (same owner-scoping block, same funnel/manager/team filters), with one
-- addition: p_until, needed so a specific selected month (Oylik picker)
-- can be bounded to exactly that month rather than "since the 1st, to
-- today" like the other RPCs' p_since-only filtering does -- correctness
-- here matters because CPL/ROI divides a month's leads by that same
-- month's marketing_spend row.
create or replace function public.lead_analytics_marketing(
  p_funnel text default null,
  p_manager uuid default null,
  p_team uuid default null,
  p_since timestamptz default null,
  p_until timestamptz default null
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_org uuid := public.current_user_org_id();
  v_scope_owner_ids uuid[];
  v_by_source jsonb;
  v_by_campaign jsonb;
  v_quality_by_source jsonb;
  v_lost_reasons_by_source jsonb;
  v_speed_by_source jsonb;
  v_daily_trend jsonb;
begin
  select case
    when public.current_user_role() in ('super_admin', 'platform_owner') then null::uuid[]
    when public.current_user_role() = 'rop' then (
      select array_agg(id) from public.profiles
      where id = auth.uid() or manager_id = auth.uid()
    )
    else array[auth.uid()]
  end into v_scope_owner_ids;

  select coalesce(jsonb_agg(row_to_json(t) order by t.total desc), '[]'::jsonb) into v_by_source
  from (
    select
      coalesce(l.source, '—') as source,
      count(*) as total,
      count(*) filter (where s.is_won) as won,
      count(*) filter (where s.is_lost) as lost,
      coalesce(sum(l.expected_revenue) filter (where s.is_won), 0) as revenue,
      round(
        (count(*) filter (where s.is_won))::numeric
        / nullif(count(*) filter (where s.is_won or s.is_lost), 0) * 100,
        1
      ) as conversion
    from leads l
    join pipeline_stages s on s.id = l.stage_id
    where l.organization_id = v_org
      and (v_scope_owner_ids is null or l.owner_id = any(v_scope_owner_ids))
      and (p_funnel is null or l.funnel = p_funnel)
      and (p_manager is null or l.owner_id = p_manager)
      and (p_team is null or l.owner_id = p_team or l.owner_id in (select id from profiles where manager_id = p_team))
      and (p_since is null or l.created_at >= p_since)
      and (p_until is null or l.created_at < p_until)
    group by coalesce(l.source, '—')
    limit 20
  ) t;

  select coalesce(jsonb_agg(row_to_json(t) order by t.total desc), '[]'::jsonb) into v_by_campaign
  from (
    select
      coalesce(l.campaign, '—') as campaign,
      count(*) as total,
      count(*) filter (where s.is_won) as won,
      count(*) filter (where s.is_lost) as lost,
      coalesce(sum(l.expected_revenue) filter (where s.is_won), 0) as revenue,
      round(
        (count(*) filter (where s.is_won))::numeric
        / nullif(count(*) filter (where s.is_won or s.is_lost), 0) * 100,
        1
      ) as conversion
    from leads l
    join pipeline_stages s on s.id = l.stage_id
    where l.organization_id = v_org
      and (v_scope_owner_ids is null or l.owner_id = any(v_scope_owner_ids))
      and (p_funnel is null or l.funnel = p_funnel)
      and (p_manager is null or l.owner_id = p_manager)
      and (p_team is null or l.owner_id = p_team or l.owner_id in (select id from profiles where manager_id = p_team))
      and (p_since is null or l.created_at >= p_since)
      and (p_until is null or l.created_at < p_until)
    group by coalesce(l.campaign, '—')
    limit 20
  ) t;

  select coalesce(jsonb_agg(row_to_json(t) order by t.total desc), '[]'::jsonb) into v_quality_by_source
  from (
    select
      coalesce(l.source, '—') as source,
      count(*) filter (where lqs.qualified = true) as qualified,
      count(*) filter (where lqs.qualified = false) as unqualified,
      count(*) filter (where l.lead_quality_stage_id is null) as unscored,
      count(*) as total
    from leads l
    left join lead_quality_stages lqs on lqs.id = l.lead_quality_stage_id
    where l.organization_id = v_org
      and (v_scope_owner_ids is null or l.owner_id = any(v_scope_owner_ids))
      and (p_funnel is null or l.funnel = p_funnel)
      and (p_manager is null or l.owner_id = p_manager)
      and (p_team is null or l.owner_id = p_team or l.owner_id in (select id from profiles where manager_id = p_team))
      and (p_since is null or l.created_at >= p_since)
      and (p_until is null or l.created_at < p_until)
    group by coalesce(l.source, '—')
    limit 20
  ) t;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_lost_reasons_by_source
  from (
    select
      coalesce(l.source, '—') as source,
      coalesce(l.loss_reason, '—') as reason,
      count(*) as count
    from leads l
    join pipeline_stages s on s.id = l.stage_id
    where l.organization_id = v_org
      and s.is_lost
      and (v_scope_owner_ids is null or l.owner_id = any(v_scope_owner_ids))
      and (p_funnel is null or l.funnel = p_funnel)
      and (p_manager is null or l.owner_id = p_manager)
      and (p_team is null or l.owner_id = p_team or l.owner_id in (select id from profiles where manager_id = p_team))
      and (p_since is null or l.created_at >= p_since)
      and (p_until is null or l.created_at < p_until)
    group by coalesce(l.source, '—'), coalesce(l.loss_reason, '—')
    order by count(*) desc
    limit 40
  ) t;

  select coalesce(jsonb_agg(row_to_json(t) order by t.sample_size desc), '[]'::jsonb) into v_speed_by_source
  from (
    select
      coalesce(x.source, '—') as source,
      round(avg(extract(epoch from (x.first_call - x.created_at)) / 3600)::numeric, 1) as avg_hours,
      count(*) as sample_size
    from (
      select l.id, l.source, l.created_at, min(c.occurred_at) as first_call
      from leads l
      join amocrm_calls c on c.lead_id = l.id
      where l.organization_id = v_org
        and (v_scope_owner_ids is null or l.owner_id = any(v_scope_owner_ids))
        and (p_funnel is null or l.funnel = p_funnel)
        and (p_manager is null or l.owner_id = p_manager)
        and (p_team is null or l.owner_id = p_team or l.owner_id in (select id from profiles where manager_id = p_team))
        and (p_since is null or l.created_at >= p_since)
        and (p_until is null or l.created_at < p_until)
      group by l.id, l.source, l.created_at
    ) x
    where x.first_call is not null and x.first_call >= x.created_at
    group by coalesce(x.source, '—')
    limit 20
  ) t;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_daily_trend
  from (
    select
      to_char(date_trunc('day', l.created_at), 'YYYY-MM-DD') as date,
      coalesce(l.source, '—') as source,
      count(*) as count
    from leads l
    where l.organization_id = v_org
      and (v_scope_owner_ids is null or l.owner_id = any(v_scope_owner_ids))
      and (p_funnel is null or l.funnel = p_funnel)
      and (p_manager is null or l.owner_id = p_manager)
      and (p_team is null or l.owner_id = p_team or l.owner_id in (select id from profiles where manager_id = p_team))
      and l.created_at >= coalesce(p_since, now() - interval '90 days')
      and (p_until is null or l.created_at < p_until)
    group by date_trunc('day', l.created_at), coalesce(l.source, '—')
    order by date_trunc('day', l.created_at)
  ) t;

  return jsonb_build_object(
    'bySource', v_by_source,
    'byCampaign', v_by_campaign,
    'qualityBySource', v_quality_by_source,
    'lostReasonsBySource', v_lost_reasons_by_source,
    'speedBySource', v_speed_by_source,
    'dailyTrend', v_daily_trend
  );
end;
$$;
grant execute on function public.lead_analytics_marketing(text, uuid, uuid, timestamptz, timestamptz) to authenticated;

-- Per-org marketing spend, entered manually per source/campaign per month --
-- the only way to compute CPL/ROI, since nothing else in the schema tracks
-- ad spend (leads.budget is the prospect's own stated budget, unrelated).
create table if not exists public.marketing_spend (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  source text not null,
  -- '' (not null) rather than a nullable campaign -- ON CONFLICT against
  -- the unique index below needs a plain column list, which a nullable
  -- column can't satisfy the way a functional/coalesce-based index would.
  campaign text not null default '',
  month date not null,
  amount numeric not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists marketing_spend_org_source_campaign_month_key
  on public.marketing_spend (organization_id, source, campaign, month);

alter table public.marketing_spend enable row level security;

drop trigger if exists set_org_id on public.marketing_spend;
create trigger set_org_id before insert on public.marketing_spend
  for each row execute function public.set_organization_id();

drop trigger if exists set_updated_at on public.marketing_spend;
create trigger set_updated_at before update on public.marketing_spend
  for each row execute function public.set_updated_at();

drop policy if exists "marketing_spend_select" on public.marketing_spend;
create policy "marketing_spend_select" on public.marketing_spend for select to authenticated
  using (organization_id = public.current_user_org_id() or public.is_platform_owner());

drop policy if exists "marketing_spend_write" on public.marketing_spend;
create policy "marketing_spend_write" on public.marketing_spend for all to authenticated
  using (organization_id = public.current_user_org_id() and public.current_user_role() = 'super_admin')
  with check (organization_id = public.current_user_org_id() and public.current_user_role() = 'super_admin');
