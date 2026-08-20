-- Lead "ball" (score) and "harorat" (temperature) have never been real —
-- AmoCRM sync always wrote score=50/temperature='Warm' for every lead (see
-- client.server.ts), since AmoCRM itself has no such concept. Going
-- forward these are driven by the AI call-analysis pipeline instead (see
-- audio-analytics.analyze.ts): whenever a call gets analyzed, its
-- score/mood roll up onto the lead it belongs to. This block only adds the
-- schema pieces (a 4th temperature tier to match "Juda issiq" in the Lead
-- Analytics redesign, plus a real loss_reason column synced from AmoCRM's
-- own loss-reasons catalog) -- the backfill and app-code wiring are
-- separate, since a newly added enum value can't be used in the same
-- transaction that adds it.
alter type public.lead_temperature add value if not exists 'VeryHot';

alter table public.leads
  add column if not exists loss_reason text;
