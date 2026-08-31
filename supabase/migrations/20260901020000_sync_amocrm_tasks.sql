-- "Lid zadachalari" (Lead Tasks) always showed the wrong picture because
-- AmoCRM's own tasks were never synced into public.tasks at all -- that page
-- only ever read locally-created tasks (from quick-create.tsx). This column
-- lets the new syncTasksFromAmo() upsert idempotently, the same pattern as
-- amocrm_id on leads/companies/contacts.
--
-- A plain (non-partial) unique index is deliberate: Postgres never treats
-- two NULLs as equal for uniqueness, so manually-created tasks (which never
-- set amocrm_task_id) can coexist freely without needing a partial WHERE
-- clause -- which matters because Supabase-js's .upsert(rows, {onConflict:
-- "organization_id,amocrm_task_id"}) generates a plain ON CONFLICT(columns)
-- clause that can only target a non-partial unique index.
alter table public.tasks add column if not exists amocrm_task_id bigint;

create unique index if not exists tasks_org_amocrm_task_id_key
  on public.tasks (organization_id, amocrm_task_id);
