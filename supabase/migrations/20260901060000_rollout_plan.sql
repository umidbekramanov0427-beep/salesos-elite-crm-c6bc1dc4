-- "Amalga oshirish rejasi" -- a super_admin-only, per-organization phased
-- implementation checklist (day/week, phase, task, weight, status, note),
-- modeled directly on the user's own 30/35-day Google Sheets rollout
-- strategy docs. This is deliberately org-scoped (each company's own
-- super_admin manages their own plan after logging into their own org),
-- not a platform_owner cross-company tool.
create table if not exists public.rollout_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  start_date date not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rollout_plans enable row level security;

drop trigger if exists set_org_id on public.rollout_plans;
create trigger set_org_id before insert on public.rollout_plans
  for each row execute function public.set_organization_id();

drop trigger if exists set_updated_at on public.rollout_plans;
create trigger set_updated_at before update on public.rollout_plans
  for each row execute function public.set_updated_at();

-- Read is also super_admin-only (not every org member) -- the user was
-- explicit this should only be visible after logging in as the company's
-- own super_admin, same restriction as write.
drop policy if exists "rollout_plans_select" on public.rollout_plans;
create policy "rollout_plans_select" on public.rollout_plans for select to authenticated
  using (organization_id = public.current_user_org_id() and public.current_user_role() = 'super_admin');

drop policy if exists "rollout_plans_write" on public.rollout_plans;
create policy "rollout_plans_write" on public.rollout_plans for all to authenticated
  using (organization_id = public.current_user_org_id() and public.current_user_role() = 'super_admin')
  with check (organization_id = public.current_user_org_id() and public.current_user_role() = 'super_admin');

create table if not exists public.rollout_plan_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.rollout_plans(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  day_number integer not null check (day_number >= 1),
  phase text not null,
  task text not null,
  weight text not null default 'medium' check (weight in ('light', 'medium', 'heavy')),
  status text not null default 'not_done' check (status in ('done', 'in_progress', 'not_done')),
  note text not null default '',
  position integer not null default 0,
  -- Set the moment status flips to 'done' (cleared if unchecked) -- the real
  -- progress chart plots actual completion against calendar dates, which the
  -- status column alone can't answer since it has no history.
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rollout_plan_tasks_plan_idx
  on public.rollout_plan_tasks (plan_id, day_number, position);

alter table public.rollout_plan_tasks enable row level security;

drop trigger if exists set_org_id on public.rollout_plan_tasks;
create trigger set_org_id before insert on public.rollout_plan_tasks
  for each row execute function public.set_organization_id();

drop trigger if exists set_updated_at on public.rollout_plan_tasks;
create trigger set_updated_at before update on public.rollout_plan_tasks
  for each row execute function public.set_updated_at();

drop policy if exists "rollout_plan_tasks_select" on public.rollout_plan_tasks;
create policy "rollout_plan_tasks_select" on public.rollout_plan_tasks for select to authenticated
  using (organization_id = public.current_user_org_id() and public.current_user_role() = 'super_admin');

drop policy if exists "rollout_plan_tasks_write" on public.rollout_plan_tasks;
create policy "rollout_plan_tasks_write" on public.rollout_plan_tasks for all to authenticated
  using (organization_id = public.current_user_org_id() and public.current_user_role() = 'super_admin')
  with check (organization_id = public.current_user_org_id() and public.current_user_role() = 'super_admin');
