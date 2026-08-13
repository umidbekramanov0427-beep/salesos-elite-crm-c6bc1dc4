-- Speed up every CRM page load. RLS policies filter by organization_id
-- (and, per the sotuv_menejeri/rop role scoping, owner_id/manager_id) on
-- essentially every query against these tables, and the client fetches
-- them page-by-page ordered by id/created_at/updated_at -- without an
-- index on those columns, every page request is a full table scan
-- re-evaluated per row against the RLS policy. None of the core CRM
-- tables had an index on organization_id (or owner_id/stage_id/lead_id)
-- before this. Safe to re-run -- IF NOT EXISTS everywhere.

create index if not exists leads_org_idx on public.leads (organization_id);
create index if not exists leads_owner_idx on public.leads (owner_id);
create index if not exists leads_stage_idx on public.leads (stage_id);
create index if not exists leads_manager_idx on public.leads (manager_id);
create index if not exists leads_org_updated_idx on public.leads (organization_id, updated_at desc);

create index if not exists contacts_org_idx on public.contacts (organization_id);
create index if not exists contacts_owner_idx on public.contacts (owner_id);
create index if not exists contacts_company_idx on public.contacts (company_id);

create index if not exists companies_org_idx on public.companies (organization_id);
create index if not exists companies_owner_idx on public.companies (owner_id);

create index if not exists deals_org_idx on public.deals (organization_id);
create index if not exists deals_owner_idx on public.deals (owner_id);
create index if not exists deals_stage_idx on public.deals (stage_id);
create index if not exists deals_lead_idx on public.deals (lead_id);
create index if not exists deals_contact_idx on public.deals (contact_id);
create index if not exists deals_company_idx on public.deals (company_id);

create index if not exists tasks_org_idx on public.tasks (organization_id);
create index if not exists tasks_assignee_idx on public.tasks (assignee_id);
create index if not exists tasks_lead_idx on public.tasks (lead_id);
create index if not exists tasks_org_due_idx on public.tasks (organization_id, due_date);

create index if not exists profiles_org_idx on public.profiles (organization_id);
create index if not exists profiles_manager_idx on public.profiles (manager_id);

create index if not exists pipeline_stages_org_idx on public.pipeline_stages (organization_id);

create index if not exists notifications_org_idx on public.notifications (organization_id);
create index if not exists notifications_user_idx on public.notifications (user_id);
create index if not exists lead_activities_org_idx on public.lead_activities (organization_id);
create index if not exists lead_activities_lead_idx on public.lead_activities (lead_id);

create index if not exists amocrm_calls_org_idx on public.amocrm_calls (organization_id);
