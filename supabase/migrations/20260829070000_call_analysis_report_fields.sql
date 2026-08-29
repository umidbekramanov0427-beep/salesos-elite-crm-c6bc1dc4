-- The real "Hisobot namunasi" (daily report sample) needs to compute, per
-- day: which service line each call was about, which lead-quality stage
-- each lead lands in, and what the AI extracted for each configured
-- "Anketa savollari" question -- none of that was ever persisted, only
-- fed to the AI as read-only context (see buildPlaybookBlock). Adds the
-- three columns the call-analysis endpoint now fills in going forward;
-- calls analyzed before this migration simply have them null/empty.

alter table public.amocrm_calls add column if not exists service_line_id uuid
  references public.service_lines(id) on delete set null;
alter table public.amocrm_calls add column if not exists intake_answers jsonb not null default '{}'::jsonb;

alter table public.leads add column if not exists lead_quality_stage_id uuid
  references public.lead_quality_stages(id) on delete set null;

create index if not exists amocrm_calls_service_line_idx on public.amocrm_calls (service_line_id);
create index if not exists leads_lead_quality_stage_idx on public.leads (lead_quality_stage_id);
