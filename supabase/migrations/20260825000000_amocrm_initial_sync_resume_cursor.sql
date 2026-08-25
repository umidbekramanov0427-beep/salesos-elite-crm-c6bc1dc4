-- A brand-new AmoCRM connection with a large lead history was consistently
-- failing to ever complete its first sync: "Oxirgi sinxronizatsiya: Hech
-- qachon" (never) with "Oxirgi xatolik: The operation was aborted" on every
-- attempt. Root cause: the initial full historical backfill (last_synced_at
-- still null, so there's no filter[updated_at][from] to narrow the pull)
-- walks every page of the account's leads sequentially inside ONE function
-- invocation -- for an account with thousands of leads that's comfortably
-- long enough to exceed the hosting platform's own request time limit,
-- which kills the in-flight fetch with the exact "operation was aborted"
-- message seen in the error field. Since last_synced_at never gets set on
-- a killed run, every retry restarts from page 1 and hits the same wall.
--
-- Fix (paired with a client.server.ts change): cap how much of the leads
-- backfill runs per invocation with a wall-clock time budget, and persist
-- how far it got in this new column so the next 5-minute cron tick resumes
-- from that page instead of restarting -- the existing 5-minute schedule
-- becomes the resume mechanism for free, with no new scheduling needed.
alter table public.amocrm_connection
  add column if not exists initial_sync_page integer;
