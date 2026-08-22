-- Root cause of "calls never link to a lead" (funnel filter always empty,
-- OPERATOR/LID columns showing "—"/raw phone instead of the real name):
-- amocrm_calls only ever stored our OWN internal lead_id, resolved once at
-- insert time against whatever was in public.leads that exact moment. If a
-- call's AmoCRM lead hadn't been synced yet (e.g. its pipeline wasn't in
-- "Import qilinadigan voronkalar" at the time), lead_id was permanently
-- stored as null -- with no way to ever repair it later, since the AmoCRM
-- lead id itself (entity_id) was thrown away, not stored anywhere.
--
-- This adds that missing raw id so a later sync (once the right pipelines
-- are enabled and the lead finally exists) can go back and fix already-
-- inserted rows instead of leaving them permanently orphaned.
alter table public.amocrm_calls
  add column if not exists amocrm_lead_entity_id bigint;

create index if not exists amocrm_calls_orphaned_idx
  on public.amocrm_calls (organization_id, amocrm_lead_entity_id)
  where lead_id is null and amocrm_lead_entity_id is not null;
