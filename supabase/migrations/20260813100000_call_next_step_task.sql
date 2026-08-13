-- Structured "next step" produced by call analysis, plus tracking for the
-- AmoCRM task automatically created from it (so re-analyzing a call never
-- creates a second duplicate task in AmoCRM).
alter table public.amocrm_calls
  add column if not exists next_step text,
  add column if not exists amocrm_task_id bigint,
  add column if not exists task_created_at timestamptz;
