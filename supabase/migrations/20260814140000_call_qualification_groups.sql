-- Qualification Groups: BANT-style (Budget/Authority/Need/Timeline) lead
-- qualification checklists, one group per funnel/use-case. Each group holds
-- its own weighted criteria rather than hardcoding exactly four BANT rows,
-- since teams often add/rename criteria beyond textbook BANT.
create table public.call_qualification_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  funnel text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.call_qualification_criteria (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  group_id uuid not null references public.call_qualification_groups(id) on delete cascade,
  label text not null,
  weight numeric not null default 1,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index call_qualification_groups_org_idx
  on public.call_qualification_groups(organization_id, position);
create index call_qualification_criteria_group_idx
  on public.call_qualification_criteria(group_id, position);
create index call_qualification_criteria_org_idx
  on public.call_qualification_criteria(organization_id);

alter table public.call_qualification_groups enable row level security;
alter table public.call_qualification_criteria enable row level security;

create trigger set_org_id before insert on public.call_qualification_groups
  for each row execute function public.set_organization_id();
create trigger set_org_id before insert on public.call_qualification_criteria
  for each row execute function public.set_organization_id();

create policy "call_qualification_groups_select" on public.call_qualification_groups
  for select to authenticated using (organization_id = public.current_user_org_id());
create policy "call_qualification_groups_write" on public.call_qualification_groups
  for all to authenticated
  using (organization_id = public.current_user_org_id() and public.is_admin_or_manager())
  with check (organization_id = public.current_user_org_id() and public.is_admin_or_manager());

create policy "call_qualification_criteria_select" on public.call_qualification_criteria
  for select to authenticated using (organization_id = public.current_user_org_id());
create policy "call_qualification_criteria_write" on public.call_qualification_criteria
  for all to authenticated
  using (organization_id = public.current_user_org_id() and public.is_admin_or_manager())
  with check (organization_id = public.current_user_org_id() and public.is_admin_or_manager());
