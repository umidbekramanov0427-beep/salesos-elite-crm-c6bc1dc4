-- Structured AI call-analysis output: a 0-100 score (computed from the
-- Stages/Steps rubric when one is configured, otherwise a holistic AI
-- estimate), a mood label, an estimated rep/customer talk ratio, and a rich
-- `analysis` blob (stage checklist results, strengths, improvements,
-- warnings, risks, agreements, key quotes, top objections) that the redesigned
-- Audio Analytics panel renders. ai_summary/next_step (already existed) are
-- unchanged and still drive the AmoCRM task-creation flow.
alter table public.amocrm_calls
  add column if not exists score integer,
  add column if not exists mood text,
  add column if not exists talk_ratio integer,
  add column if not exists analysis jsonb;
