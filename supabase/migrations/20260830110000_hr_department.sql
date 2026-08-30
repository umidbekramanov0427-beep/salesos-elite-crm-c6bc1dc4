-- Kadrlar bo'limi (HR recruiting). A vacancy gets its own Telegram bot
-- deep-link token (?start=<token>) posted to job channels; the bot asks
-- every candidate the same org-wide, ordered set of screening questions
-- one at a time and records each answer; the resulting candidate gets a
-- status tag (yangi/korib_chiqilmoqda/band_qilindi/rad_etildi) that the
-- CRM's own super_admin sets by hand -- every change requires a reason and
-- is kept as permanent history, never just overwritten, since the whole
-- point of the tag is a traceable "why" behind it.

create table if not exists public.hr_vacancies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  title text not null,
  active boolean not null default true,
  telegram_start_token text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists hr_vacancies_start_token_key
  on public.hr_vacancies (telegram_start_token);

alter table public.hr_vacancies enable row level security;

drop trigger if exists set_org_id on public.hr_vacancies;
create trigger set_org_id before insert on public.hr_vacancies
  for each row execute function public.set_organization_id();

drop policy if exists "hr_vacancies_select" on public.hr_vacancies;
create policy "hr_vacancies_select" on public.hr_vacancies for select to authenticated
  using (organization_id = public.current_user_org_id() or public.is_platform_owner());

drop policy if exists "hr_vacancies_write" on public.hr_vacancies;
create policy "hr_vacancies_write" on public.hr_vacancies for all to authenticated
  using (organization_id = public.current_user_org_id() and public.current_user_role() = 'super_admin')
  with check (organization_id = public.current_user_org_id() and public.current_user_role() = 'super_admin');

-- Org-wide screening questions, asked in `position` order to every
-- candidate regardless of which vacancy they came from.
create table if not exists public.hr_questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  question text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.hr_questions enable row level security;

drop trigger if exists set_org_id on public.hr_questions;
create trigger set_org_id before insert on public.hr_questions
  for each row execute function public.set_organization_id();

drop policy if exists "hr_questions_select" on public.hr_questions;
create policy "hr_questions_select" on public.hr_questions for select to authenticated
  using (organization_id = public.current_user_org_id() or public.is_platform_owner());

drop policy if exists "hr_questions_write" on public.hr_questions;
create policy "hr_questions_write" on public.hr_questions for all to authenticated
  using (organization_id = public.current_user_org_id() and public.current_user_role() = 'super_admin')
  with check (organization_id = public.current_user_org_id() and public.current_user_role() = 'super_admin');

-- One row per Telegram chat that has ever gone through a vacancy's bot
-- flow. Only ever written by the webhook (service role) except for the
-- status column, which the CRM UI updates directly.
create table if not exists public.hr_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  vacancy_id uuid not null references public.hr_vacancies(id) on delete cascade,
  telegram_chat_id bigint not null,
  telegram_username text,
  current_question_position integer not null default 0,
  completed_at timestamptz,
  status text not null default 'yangi'
    check (status in ('yangi', 'korib_chiqilmoqda', 'band_qilindi', 'rad_etildi')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The webhook's hot lookup on every incoming message: "does this chat have
-- an application still in progress?"
create index if not exists hr_candidates_open_chat_idx
  on public.hr_candidates (telegram_chat_id) where completed_at is null;

alter table public.hr_candidates enable row level security;

drop policy if exists "hr_candidates_select" on public.hr_candidates;
create policy "hr_candidates_select" on public.hr_candidates for select to authenticated
  using (organization_id = public.current_user_org_id() or public.is_platform_owner());

drop policy if exists "hr_candidates_update" on public.hr_candidates;
create policy "hr_candidates_update" on public.hr_candidates for update to authenticated
  using (organization_id = public.current_user_org_id() and public.current_user_role() = 'super_admin')
  with check (organization_id = public.current_user_org_id() and public.current_user_role() = 'super_admin');

create table if not exists public.hr_candidate_answers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  candidate_id uuid not null references public.hr_candidates(id) on delete cascade,
  question_id uuid not null references public.hr_questions(id),
  answer_text text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists hr_candidate_answers_unique
  on public.hr_candidate_answers (candidate_id, question_id);

alter table public.hr_candidate_answers enable row level security;

drop policy if exists "hr_candidate_answers_select" on public.hr_candidate_answers;
create policy "hr_candidate_answers_select" on public.hr_candidate_answers for select to authenticated
  using (organization_id = public.current_user_org_id() or public.is_platform_owner());

-- Every status change, permanently, with the mandatory reason behind it --
-- hr_candidates.status is the fast-access "current" value, this table is
-- the full trail. Inserted directly by the CRM UI (super_admin), unlike
-- hr_candidates/hr_candidate_answers which only the webhook ever writes.
create table if not exists public.hr_candidate_status_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  candidate_id uuid not null references public.hr_candidates(id) on delete cascade,
  status text not null
    check (status in ('yangi', 'korib_chiqilmoqda', 'band_qilindi', 'rad_etildi')),
  reason text not null,
  changed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.hr_candidate_status_history enable row level security;

drop trigger if exists set_org_id on public.hr_candidate_status_history;
create trigger set_org_id before insert on public.hr_candidate_status_history
  for each row execute function public.set_organization_id();

drop policy if exists "hr_candidate_status_history_select" on public.hr_candidate_status_history;
create policy "hr_candidate_status_history_select" on public.hr_candidate_status_history for select to authenticated
  using (organization_id = public.current_user_org_id() or public.is_platform_owner());

drop policy if exists "hr_candidate_status_history_insert" on public.hr_candidate_status_history;
create policy "hr_candidate_status_history_insert" on public.hr_candidate_status_history for insert to authenticated
  with check (organization_id = public.current_user_org_id() and public.current_user_role() = 'super_admin');

-- Singleton per org: the invite link the bot sends once a candidate
-- finishes every question.
create table if not exists public.hr_settings (
  organization_id uuid primary key references public.organizations(id),
  academy_channel_invite_link text,
  updated_at timestamptz not null default now()
);

alter table public.hr_settings enable row level security;

drop policy if exists "hr_settings_select" on public.hr_settings;
create policy "hr_settings_select" on public.hr_settings for select to authenticated
  using (organization_id = public.current_user_org_id() or public.is_platform_owner());

drop policy if exists "hr_settings_write" on public.hr_settings;
create policy "hr_settings_write" on public.hr_settings for all to authenticated
  using (organization_id = public.current_user_org_id() and public.current_user_role() = 'super_admin')
  with check (organization_id = public.current_user_org_id() and public.current_user_role() = 'super_admin');
