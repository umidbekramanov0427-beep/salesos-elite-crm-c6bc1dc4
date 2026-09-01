-- Lets a super_admin pick a background color per phase (e.g. "1-BOSQICH:
-- Baza audit") so a 7-phase plan reads at a glance instead of being a wall
-- of identical rows. Colors are stored once per (plan, phase) pair, not
-- duplicated onto every task row, so every task sharing a phase name always
-- shows the same color and a single change updates them all.
create table if not exists public.rollout_plan_phase_colors (
  plan_id uuid not null references public.rollout_plans(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  phase text not null,
  color text not null check (
    color in ('slate', 'blue', 'purple', 'pink', 'orange', 'teal', 'indigo', 'cyan')
  ),
  updated_at timestamptz not null default now(),
  primary key (plan_id, phase)
);

alter table public.rollout_plan_phase_colors enable row level security;

drop trigger if exists set_org_id on public.rollout_plan_phase_colors;
create trigger set_org_id before insert on public.rollout_plan_phase_colors
  for each row execute function public.set_organization_id();

drop trigger if exists set_updated_at on public.rollout_plan_phase_colors;
create trigger set_updated_at before update on public.rollout_plan_phase_colors
  for each row execute function public.set_updated_at();

drop policy if exists "rollout_plan_phase_colors_select" on public.rollout_plan_phase_colors;
create policy "rollout_plan_phase_colors_select" on public.rollout_plan_phase_colors
  for select to authenticated
  using (organization_id = public.current_user_org_id() and public.current_user_role() = 'super_admin');

drop policy if exists "rollout_plan_phase_colors_write" on public.rollout_plan_phase_colors;
create policy "rollout_plan_phase_colors_write" on public.rollout_plan_phase_colors
  for all to authenticated
  using (organization_id = public.current_user_org_id() and public.current_user_role() = 'super_admin')
  with check (organization_id = public.current_user_org_id() and public.current_user_role() = 'super_admin');
