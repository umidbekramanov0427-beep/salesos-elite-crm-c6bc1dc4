-- Schedules /fines/compute to run every day at 21:00 Tashkent time, same
-- pg_cron + pg_net pattern as the daily report and AmoCRM auto-sync jobs.
--
-- IMPORTANT — two things to check after running this:
-- 1. The url below assumes the app is deployed at
--    https://salesos-elite-crm.lovable.app — if your real production URL
--    is different, edit the `url` value below before running.
-- 2. CRON_SECRET must already be set as an environment variable (the same
--    one used by the other cron jobs) — /fines/compute rejects any request
--    whose x-cron-secret header doesn't match it.
--
-- '0 16 * * *' = 16:00 UTC = 21:00 in Tashkent (UTC+5, no DST).
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'fines-daily-compute-2100-tashkent',
  '0 16 * * *',
  $$
  select net.http_post(
    url := 'https://salesos-elite-crm.lovable.app/fines/compute',
    headers := '{"content-type": "application/json", "x-cron-secret": "VSA_17u2QB5AV7nCuYoTHk3-dH-ydOJw07UBkiC5z3g"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
