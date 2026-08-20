-- Backs Lead Analytics' "Lead sifati" tab. Same reasoning as
-- lead_analytics_action: this org has tens of thousands of leads, so
-- per-tag aggregation (unnest(tags)) has to run in SQL, not by downloading
-- every lead to the browser.
create or replace function public.lead_analytics_quality(
  p_funnel text default null,
  p_manager uuid default null
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_org uuid := public.current_user_org_id();
  v_tag_results jsonb;
  v_tag_matrix jsonb;
  v_tag_categories jsonb;
begin
  -- "Har bir teg bilan nima bo'lgan" -- per-tag sold/lost/open split.
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
      and (p_funnel is null or l.funnel = p_funnel)
      and (p_manager is null or l.owner_id = p_manager)
    group by tag
    order by count(*) desc
    limit 15
  ) t;

  -- "Teg sifati matritsasi" -- avg AI call-analysis score + conversion% per
  -- tag. Tags under 10 leads are flagged low_sample (the UI dims them,
  -- matching the reference tool's own footnote about 0%/100% noise).
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
      and (p_funnel is null or l.funnel = p_funnel)
      and (p_manager is null or l.owner_id = p_manager)
    group by tag
    order by count(*) desc
    limit 15
  ) t;

  -- "Teg bo'yicha kategoriyalar" -- temperature split for the top 10 tags
  -- by volume (same tag set the other two widgets already lead with).
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
      and (p_funnel is null or l.funnel = p_funnel)
      and (p_manager is null or l.owner_id = p_manager)
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

grant execute on function public.lead_analytics_quality(text, uuid) to authenticated;
