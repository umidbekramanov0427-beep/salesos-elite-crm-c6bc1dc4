-- Role redesign step 1 of 2: add the two new app_role values. Postgres
-- forbids using a brand-new enum value in the same transaction it was
-- added in, so this has to be its own migration/run, committed before
-- 20260812150100_role_redesign_2_migrate.sql (which uses these values)
-- can run. 'manager' and 'rep' stay in the enum — Postgres can't drop
-- enum values without a full type rebuild, and it's not worth the risk
-- here; the app and every policy just stop referencing them.

alter type public.app_role add value if not exists 'rop';
alter type public.app_role add value if not exists 'sotuv_menejeri';
