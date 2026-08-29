-- "Baholash mezoni" (scoring criteria) config layer: lets an admin define
-- exactly how the call-analysis AI grades calls, instead of the current
-- single freeform prompt textarea + flat one-point-per-step checklist.
-- Extends the existing call_stages/call_stage_steps/call_categories
-- (20260814130000_call_score_rubric.sql) rather than replacing them.

-- Weighted category (e.g. "Salomlashish 12%") -- was previously unweighted.
alter table public.call_stages add column if not exists weight_percent numeric not null default 0;

-- Each criterion (A1, A2...) gets a short code plus a real 4-level rubric
-- (what a 0/1/2/3 answer actually looks like) instead of a single flat
-- point value with no description of what earns it.
alter table public.call_stage_steps add column if not exists code text;
alter table public.call_stage_steps add column if not exists level_0_desc text not null default '';
alter table public.call_stage_steps add column if not exists level_1_desc text not null default '';
alter table public.call_stage_steps add column if not exists level_2_desc text not null default '';
alter table public.call_stage_steps add column if not exists level_3_desc text not null default '';

-- "Qo'ng'iroq oilalari": call_categories become the classifier for which
-- kind of call this is and whether it should be scored at all.
alter table public.call_categories add column if not exists scored boolean not null default true;
alter table public.call_categories add column if not exists system_family boolean not null default false;
alter table public.call_categories add column if not exists workflow_family text;
alter table public.call_categories add column if not exists conversation_domain text;
alter table public.call_categories add column if not exists temporary boolean not null default false;
alter table public.call_categories add column if not exists exclusion_reason text;

-- "Xizmat yo'nalishlari": the business's own service/product lines, with
-- aliases and sample phrases so the AI can route a call to the right one.
create table if not exists public.service_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  description text not null default '',
  aliases text[] not null default '{}',
  sample_phrases text[] not null default '{}',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- "Anketa savollari": intake questions the AI should try to answer per
-- call, optionally scoped to one service line (null = general/all).
create table if not exists public.intake_questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  service_line_id uuid references public.service_lines(id) on delete cascade,
  label text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- "Lid sifati bosqichlari": ordered AI-facing lead-quality stages, each
-- marked qualified/unqualified. The last one is always the system's
-- built-in unqualified catch-all and can't be deleted.
create table if not exists public.lead_quality_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  position integer not null default 0,
  title text not null,
  conditions text[] not null default '{}',
  qualified boolean not null default true,
  system_locked boolean not null default false,
  created_at timestamptz not null default now()
);

-- "AI ko'rsatmalari" + "Lid analitikasi": structured prompt fields for the
-- call-analysis agent, replacing (well, supplementing -- system_prompt
-- stays as a fallback/override) the single freeform textarea with the
-- specific questions Metasell's reference breaks it into.
alter table public.ai_agents add column if not exists call_instructions jsonb not null default '{}'::jsonb;

alter table public.service_lines enable row level security;
alter table public.intake_questions enable row level security;
alter table public.lead_quality_stages enable row level security;

drop trigger if exists set_org_id on public.service_lines;
create trigger set_org_id before insert on public.service_lines
  for each row execute function public.set_organization_id();
drop trigger if exists set_org_id on public.intake_questions;
create trigger set_org_id before insert on public.intake_questions
  for each row execute function public.set_organization_id();
drop trigger if exists set_org_id on public.lead_quality_stages;
create trigger set_org_id before insert on public.lead_quality_stages
  for each row execute function public.set_organization_id();

drop policy if exists "service_lines_select" on public.service_lines;
create policy "service_lines_select" on public.service_lines for select to authenticated
  using (organization_id = public.current_user_org_id());
drop policy if exists "service_lines_write" on public.service_lines;
create policy "service_lines_write" on public.service_lines for all to authenticated
  using (organization_id = public.current_user_org_id() and public.is_admin_or_manager())
  with check (organization_id = public.current_user_org_id() and public.is_admin_or_manager());

drop policy if exists "intake_questions_select" on public.intake_questions;
create policy "intake_questions_select" on public.intake_questions for select to authenticated
  using (organization_id = public.current_user_org_id());
drop policy if exists "intake_questions_write" on public.intake_questions;
create policy "intake_questions_write" on public.intake_questions for all to authenticated
  using (organization_id = public.current_user_org_id() and public.is_admin_or_manager())
  with check (organization_id = public.current_user_org_id() and public.is_admin_or_manager());

drop policy if exists "lead_quality_stages_select" on public.lead_quality_stages;
create policy "lead_quality_stages_select" on public.lead_quality_stages for select to authenticated
  using (organization_id = public.current_user_org_id());
drop policy if exists "lead_quality_stages_write" on public.lead_quality_stages;
create policy "lead_quality_stages_write" on public.lead_quality_stages for all to authenticated
  using (organization_id = public.current_user_org_id() and public.is_admin_or_manager())
  with check (organization_id = public.current_user_org_id() and public.is_admin_or_manager());

create index if not exists service_lines_org_idx on public.service_lines (organization_id, position);
create index if not exists intake_questions_org_idx on public.intake_questions (organization_id, position);
create index if not exists intake_questions_service_line_idx on public.intake_questions (service_line_id);
create index if not exists lead_quality_stages_org_idx on public.lead_quality_stages (organization_id, position);

-- Seed the mandatory system stage every org needs (mirrors the reference's
-- locked "Yaroqsiz lid" catch-all) for every existing organization.
insert into public.lead_quality_stages (organization_id, position, title, conditions, qualified, system_locked)
select o.id, 999, 'Yaroqsiz lid',
  array['Tizimli holat.', 'Mijoz ariza qoldirmaganini aytadi.', 'Raqam noto''g''ri yoki boshqa odamga tegishli.'],
  false, true
from public.organizations o
where not exists (
  select 1 from public.lead_quality_stages lqs
  where lqs.organization_id = o.id and lqs.system_locked = true
);

-- Same for new organizations going forward.
create or replace function public.seed_lead_quality_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.lead_quality_stages (organization_id, position, title, conditions, qualified, system_locked)
  values (new.id, 999, 'Yaroqsiz lid',
    array['Tizimli holat.', 'Mijoz ariza qoldirmaganini aytadi.', 'Raqam noto''g''ri yoki boshqa odamga tegishli.'],
    false, true);
  return new;
end;
$$;

drop trigger if exists seed_lead_quality_stage on public.organizations;
create trigger seed_lead_quality_stage after insert on public.organizations
  for each row execute function public.seed_lead_quality_stage();
