-- Permanent, dated internal record of every day's full "Kunlik hisobot" --
-- saved by the scheduled Telegram send regardless of whether any Telegram
-- delivery below it succeeds, so the platform itself always has "hisobotni
-- sana bilan ko'rish" (view the report by date) even with no bot linked.
create table if not exists public.daily_report_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  report_date date not null,
  report_text text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists daily_report_history_org_date_key
  on public.daily_report_history (organization_id, report_date);

alter table public.daily_report_history enable row level security;

drop policy if exists "daily_report_history_select" on public.daily_report_history;
create policy "daily_report_history_select" on public.daily_report_history for select to authenticated
  using (organization_id = public.current_user_org_id() or public.is_platform_owner());

-- Written only by the service-role scheduled job (supabaseAdmin), same as
-- hr_candidates -- no insert/update policy for authenticated.

-- A company's super_admin obtains a Google Sheets URL from the platform
-- owner's side and enters it here; the platform can then write today's
-- report into that sheet automatically (still requires a one-time Google
-- service-account credential on the server -- the URL alone doesn't grant
-- write access, see src/lib/google-sheets.server.ts).
alter table public.daily_report_settings
  add column if not exists google_sheets_url text;
