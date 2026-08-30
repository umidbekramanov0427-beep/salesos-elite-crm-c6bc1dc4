-- Two-way Telegram chat with a candidate, right from inside the CRM.
-- Outbound messages go through the Kadrlar bo'limi bot (see
-- hr.send-message.ts, which sends via Telegram first and only then
-- inserts here) and inbound replies -- once a candidate has finished the
-- question flow, so free text is no longer an "answer" -- are appended
-- here by telegram.hr-webhook.ts instead of falling into its generic
-- reply. Never written by an authenticated client insert directly, same
-- as hr_candidates/hr_candidate_answers.
create table if not exists public.hr_candidate_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  candidate_id uuid not null references public.hr_candidates(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  body text not null,
  sent_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists hr_candidate_messages_candidate_idx
  on public.hr_candidate_messages (candidate_id, created_at);

alter table public.hr_candidate_messages enable row level security;

drop policy if exists "hr_candidate_messages_select" on public.hr_candidate_messages;
create policy "hr_candidate_messages_select" on public.hr_candidate_messages for select to authenticated
  using (organization_id = public.current_user_org_id() or public.is_platform_owner());
