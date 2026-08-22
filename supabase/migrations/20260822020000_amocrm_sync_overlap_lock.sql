-- The 5-minute AmoCRM cron (amocrm-auto-sync-5min) has no overlap
-- protection: if one org's sync takes longer than 5 minutes (large call-note
-- backlog, AmoCRM rate-limiting, retries), the next cron tick fires a whole
-- new sync-all pass on top of the still-running one. These stack: every
-- concurrent sync run does its own bulk upserts against leads/deals/
-- contacts/companies/amocrm_calls, competing for the same Postgres
-- connections and locking rows other pages (Reyting, Dashboard, Funnels...)
-- are trying to read at the same time -- this is the most likely cause of
-- reports that "everything is slow, every click takes minutes" starting
-- right after AmoCRM sync work landed. These two columns let
-- syncLeadsFromAmo (client.server.ts) check-and-skip instead of piling on.
alter table public.amocrm_connection
  add column if not exists sync_in_progress boolean not null default false,
  add column if not exists sync_started_at timestamptz;
