-- Backfill: leads that already have an AI-analyzed call (from the existing
-- Whisper+DeepSeek pipeline in audio-analytics.analyze.ts) get their
-- score/temperature set from that call's result right now, instead of
-- waiting for the next re-analysis. Uses each lead's most recently analyzed
-- call. Leads with no analyzed call at all keep the column defaults
-- (score=50, temperature='Warm') -- an explicit "not yet assessed" state,
-- not a lie, now that new analyses actually update these fields (see the
-- app-code change alongside this migration).
with latest_call as (
  select distinct on (lead_id) lead_id, score
  from public.amocrm_calls
  where lead_id is not null and analyzed_at is not null and score is not null
  order by lead_id, analyzed_at desc
)
update public.leads l
set
  score = lc.score,
  temperature = case
    when lc.score >= 76 then 'VeryHot'::public.lead_temperature
    when lc.score >= 51 then 'Hot'::public.lead_temperature
    when lc.score >= 26 then 'Warm'::public.lead_temperature
    else 'Cold'::public.lead_temperature
  end
from latest_call lc
where l.id = lc.lead_id;
