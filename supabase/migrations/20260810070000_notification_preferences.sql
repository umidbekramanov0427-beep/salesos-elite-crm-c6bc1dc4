-- Per-user notification preferences. Booleans only, readable by any
-- authenticated user (so a manager assigning a task can check whether the
-- assignee wants an in-app notification), writable only by the owner.
create table public.notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  task_assigned boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

create policy "notification_prefs_select_authenticated" on public.notification_preferences
  for select to authenticated using (true);

create policy "notification_prefs_upsert_self" on public.notification_preferences
  for insert to authenticated with check (profile_id = auth.uid());

create policy "notification_prefs_update_self" on public.notification_preferences
  for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
