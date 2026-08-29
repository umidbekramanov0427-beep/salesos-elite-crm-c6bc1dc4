-- "Kunlik hisobot sozlamalari" (Daily Report Settings): lets an admin
-- choose which sections appear in the automated Telegram daily report
-- (see src/lib/telegram-report.server.ts) and scope each one down to a
-- specific subset of managers / funnels / lead-quality groups / intake
-- questions, plus a custom funnel-stage-transition rule builder.

-- One settings row per organization (singleton, same pattern as
-- business_profile/ai_agents). A null array column means "hammasi
-- tanlangan" (everything selected) -- the UI treats null and "all ids
-- present" the same way, but null needs no upkeep as new items are added.
create table if not exists public.daily_report_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id),
  managers_activity_enabled boolean not null default true,
  managers_activity_manager_ids uuid[],
  leads_movement_enabled boolean not null default true,
  leads_movement_funnels text[],
  lead_quality_enabled boolean not null default true,
  lead_quality_stage_ids uuid[],
  intake_questions_enabled boolean not null default true,
  intake_question_ids uuid[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- "Voronka bosqichlari harakati": custom rules for which CRM stage
-- transitions (optionally scoped to one manager) get their own line in
-- the report -- e.g. "Aziz Rus tili 18-Patok: Yarim to'lov -> To'liq to'lov".
create table if not exists public.daily_report_stage_transition_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  manager_scope text not null default 'all' check (manager_scope in ('all', 'specific')),
  manager_id uuid references public.profiles(id) on delete cascade,
  funnel text not null,
  from_stage_id uuid references public.pipeline_stages(id) on delete cascade,
  to_stage_id uuid not null references public.pipeline_stages(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.daily_report_settings enable row level security;
alter table public.daily_report_stage_transition_rules enable row level security;

drop trigger if exists set_org_id on public.daily_report_settings;
create trigger set_org_id before insert on public.daily_report_settings
  for each row execute function public.set_organization_id();
drop trigger if exists set_org_id on public.daily_report_stage_transition_rules;
create trigger set_org_id before insert on public.daily_report_stage_transition_rules
  for each row execute function public.set_organization_id();

drop policy if exists "daily_report_settings_select" on public.daily_report_settings;
create policy "daily_report_settings_select" on public.daily_report_settings for select to authenticated
  using (organization_id = public.current_user_org_id());
drop policy if exists "daily_report_settings_write" on public.daily_report_settings;
create policy "daily_report_settings_write" on public.daily_report_settings for all to authenticated
  using (organization_id = public.current_user_org_id() and public.is_admin_or_manager())
  with check (organization_id = public.current_user_org_id() and public.is_admin_or_manager());

drop policy if exists "daily_report_stage_transition_rules_select" on public.daily_report_stage_transition_rules;
create policy "daily_report_stage_transition_rules_select" on public.daily_report_stage_transition_rules for select to authenticated
  using (organization_id = public.current_user_org_id());
drop policy if exists "daily_report_stage_transition_rules_write" on public.daily_report_stage_transition_rules;
create policy "daily_report_stage_transition_rules_write" on public.daily_report_stage_transition_rules for all to authenticated
  using (organization_id = public.current_user_org_id() and public.is_admin_or_manager())
  with check (organization_id = public.current_user_org_id() and public.is_admin_or_manager());

create index if not exists daily_report_stage_transition_rules_org_idx
  on public.daily_report_stage_transition_rules (organization_id, position);

-- Seed the settings row for every existing organization.
insert into public.daily_report_settings (organization_id)
select o.id from public.organizations o
where not exists (
  select 1 from public.daily_report_settings s where s.organization_id = o.id
);

-- Same for new organizations going forward.
create or replace function public.seed_daily_report_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.daily_report_settings (organization_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists seed_daily_report_settings on public.organizations;
create trigger seed_daily_report_settings after insert on public.organizations
  for each row execute function public.seed_daily_report_settings();
