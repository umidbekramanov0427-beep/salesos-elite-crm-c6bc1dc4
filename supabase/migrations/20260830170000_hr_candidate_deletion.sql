-- Deleting a candidate is destructive (cascades to their answers, status
-- history, and chat messages), so -- same "never just overwrite, keep a
-- reason" principle as hr_candidate_status_history -- a full snapshot of
-- the candidate plus who deleted them and why is kept permanently here
-- *before* the row itself is removed. Written only by the service-role
-- delete route (hr.delete-candidate.ts), never by an authenticated client
-- insert, so the log itself can't be falsified by whoever is deleting.
create table if not exists public.hr_candidate_deletions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  candidate_snapshot jsonb not null,
  reason text not null,
  deleted_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.hr_candidate_deletions enable row level security;

drop policy if exists "hr_candidate_deletions_select" on public.hr_candidate_deletions;
create policy "hr_candidate_deletions_select" on public.hr_candidate_deletions for select to authenticated
  using (organization_id = public.current_user_org_id() or public.is_platform_owner());
