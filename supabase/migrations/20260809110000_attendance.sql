-- Attendance: work sessions (clock in/out) and call logs. Logged manually
-- for now — when a real telephony integration is connected later, it can
-- insert into call_logs the same way amoCRM sync inserts into leads, and
-- this page keeps working unchanged.
-- Run this in the Supabase SQL Editor the same way as the earlier migrations.

create table public.work_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  created_at timestamptz not null default now()
);

create table public.call_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  phone text,
  connected boolean not null default true,
  duration_seconds int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.work_sessions enable row level security;
alter table public.call_logs enable row level security;

-- Everyone can see their own sessions/calls; admins and managers can see
-- everyone's (for the team roster view). Writes are always by the owner.
create policy "work_sessions_select" on public.work_sessions
  for select to authenticated
  using (profile_id = auth.uid() or public.is_admin_or_manager());
create policy "work_sessions_insert" on public.work_sessions
  for insert to authenticated with check (profile_id = auth.uid());
create policy "work_sessions_update" on public.work_sessions
  for update to authenticated using (profile_id = auth.uid());

create policy "call_logs_select" on public.call_logs
  for select to authenticated
  using (profile_id = auth.uid() or public.is_admin_or_manager());
create policy "call_logs_insert" on public.call_logs
  for insert to authenticated with check (profile_id = auth.uid());

create index call_logs_profile_created_idx on public.call_logs (profile_id, created_at);
create index work_sessions_profile_created_idx on public.work_sessions (profile_id, created_at);
