-- Top-level "Kunlik hisobot sozlamalari" landing page (send/language,
-- Telegram task notifications, advanced settings) -- everything below the
-- "Hisobot tarkibi" sub-page, which already has its own settings.

alter table public.daily_report_settings add column if not exists send_enabled boolean not null default true;
alter table public.daily_report_settings add column if not exists send_time time not null default '23:50:00';
alter table public.daily_report_settings add column if not exists report_language text not null default 'uz';

-- "Telegram vazifa bildirishnomalari" -- independent of the daily report
-- itself (own toggles, sent straight to a rep's personal Telegram chat).
alter table public.daily_report_settings add column if not exists task_due_reminder_enabled boolean not null default true;
alter table public.daily_report_settings add column if not exists task_due_reminder_minutes_before integer not null default 5
  check (task_due_reminder_minutes_before between 2 and 5);
alter table public.daily_report_settings add column if not exists morning_summary_enabled boolean not null default true;

-- "Kengaytirilgan sozlamalar": both default OFF per the reference.
alter table public.daily_report_settings add column if not exists manager_conversion_recommendations_enabled boolean not null default false;
-- null = every call_stage_steps criterion is included; an admin can
-- uncheck individual ones (same "null means all" convention used
-- elsewhere on this page).
alter table public.daily_report_settings add column if not exists manager_conversion_recommendation_criterion_ids uuid[];
alter table public.daily_report_settings add column if not exists call_audio_mini_app_enabled boolean not null default false;

-- "Qo'ng'iroq audiolarini Telegram Mini App'da ko'rib chiqish": which
-- funnel+stage combinations qualify a call for the per-manager Mini App
-- audio link. One row per funnel, with the set of qualifying stages.
create table if not exists public.daily_report_mini_app_audio_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  funnel text not null,
  stage_ids uuid[] not null default '{}',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.daily_report_mini_app_audio_rules enable row level security;

drop trigger if exists set_org_id on public.daily_report_mini_app_audio_rules;
create trigger set_org_id before insert on public.daily_report_mini_app_audio_rules
  for each row execute function public.set_organization_id();

drop policy if exists "daily_report_mini_app_audio_rules_select" on public.daily_report_mini_app_audio_rules;
create policy "daily_report_mini_app_audio_rules_select" on public.daily_report_mini_app_audio_rules for select to authenticated
  using (organization_id = public.current_user_org_id());
drop policy if exists "daily_report_mini_app_audio_rules_write" on public.daily_report_mini_app_audio_rules;
create policy "daily_report_mini_app_audio_rules_write" on public.daily_report_mini_app_audio_rules for all to authenticated
  using (organization_id = public.current_user_org_id() and public.is_admin_or_manager())
  with check (organization_id = public.current_user_org_id() and public.is_admin_or_manager());

create index if not exists daily_report_mini_app_audio_rules_org_idx
  on public.daily_report_mini_app_audio_rules (organization_id, position);
