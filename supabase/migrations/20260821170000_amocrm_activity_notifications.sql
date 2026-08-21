-- The bell/Inbox notification feed only ever held two static demo rows
-- seeded at initial setup ('Welcome to SalesOS Elite', 'AI Copilot is
-- ready') plus whatever a manager manually sent from Normativ's "Notify"
-- button -- nothing was ever generated from real AmoCRM activity, so the
-- feed looked unhelpful/stale next to the actual sync happening every 5
-- minutes. syncLeadsFromAmo/syncCallsFromAmo (client.server.ts) now insert
-- real notifications on lead-stage changes, new leads, owner reassignment
-- and new call recordings, scoped per viewer (rep sees own, rop sees their
-- team, super_admin/platform_owner sees the whole org) via fan-out rows,
-- the same visibility model already used for leads/deals.
--
-- This migration only removes the two now-redundant static demo rows --
-- type='Automation'/'AI' with user_id is null was exactly how the seed
-- migration (20260808120100_seed_demo_data.sql) inserted them, and nothing
-- else in the app writes those (type, user_id) combinations, so this can't
-- catch a real notification. Everything else (task_assigned, Normative,
-- and the new AmoCRM-driven types) is left untouched.
delete from public.notifications
where type in ('Automation', 'AI') and user_id is null;
