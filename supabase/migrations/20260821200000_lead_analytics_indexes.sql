-- lead_analytics_action/quality/current/direction (see
-- 20260821160000_lead_analytics_scope_and_period.sql) run 15 sub-queries
-- total against leads, each filtered by organization_id plus one of
-- funnel/created_at/temperature/last_contact_at/tags. leads_org_idx only
-- covers organization_id, so every one of those sub-queries re-scans the
-- org's full lead set and filters the rest in a sequential re-check.
-- Composite indexes let Postgres use a single index per filter instead.
create index if not exists leads_org_funnel_idx on public.leads (organization_id, funnel);
create index if not exists leads_org_created_idx on public.leads (organization_id, created_at);
create index if not exists leads_org_temperature_idx on public.leads (organization_id, temperature);
create index if not exists leads_org_last_contact_idx on public.leads (organization_id, last_contact_at);
create index if not exists leads_tags_gin_idx on public.leads using gin (tags);
