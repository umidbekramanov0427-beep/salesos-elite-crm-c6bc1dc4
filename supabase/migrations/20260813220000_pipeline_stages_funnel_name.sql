-- leads.funnel was never populated by the AmoCRM sync (it just sat at the
-- column default 'Direct Sales' for every synced lead), which collapsed
-- every real AmoCRM pipeline into one funnel everywhere the app groups or
-- filters by funnel — the Voronkalar board, the pipeline Kanban's funnel
-- filter, Reyting's funnel filter, etc. Fixing that in the sync code needs
-- each pipeline's own name available per stage, which pipeline_stages
-- never stored (only the status/stage name) — add it here.
alter table public.pipeline_stages
  add column if not exists pipeline_name text;
