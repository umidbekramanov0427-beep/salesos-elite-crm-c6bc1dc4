-- Stores the transcript + AI summary produced for a call recording once an
-- admin/rep runs "Tahlil qilish" (Analyze) on it. Nullable until analyzed.
alter table public.amocrm_calls
  add column if not exists transcript text,
  add column if not exists ai_summary text,
  add column if not exists analyzed_at timestamptz;
