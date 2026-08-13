-- Dedupe AmoCRM-synced leads/contacts.
--
-- The sync's upserts target ON CONFLICT (organization_id, amocrm_id), but
-- that composite unique constraint was never actually present on this
-- database (only the old, pre-multi-tenant single-column amocrm_id
-- constraint existed, or none at all) -- so every repeated sync run
-- inserted a fresh duplicate copy of every lead/contact instead of
-- updating the existing row in place. Confirmed via a per-organization
-- count: 67,657 lead rows and 58,452 contact rows for an account with
-- ~1,789 real leads, all inside a single organization (not cross-tenant
-- test data).
--
-- This keeps the most recently updated row per (organization_id,
-- amocrm_id), re-points every foreign key that referenced a row being
-- removed onto the row being kept (so calls/tasks/activities tied to a
-- duplicate lead aren't silently orphaned or deleted), deletes the
-- duplicates, then re-adds the composite unique constraint so this can't
-- recur. Safe to re-run -- once there's one row per (organization_id,
-- amocrm_id), every step below is a no-op.

begin;

-- 1) Drop any legacy single-column unique constraint on amocrm_id --
--    it would block re-adding the correct composite one below, and it's
--    exactly the constraint that let the upsert's ON CONFLICT clause
--    silently mismatch (a bare `amocrm_id` constraint doesn't satisfy an
--    ON CONFLICT (organization_id, amocrm_id) target, and vice versa).
do $$
declare
  r record;
begin
  for r in
    select tc.constraint_name, tc.table_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
    where tc.constraint_type = 'UNIQUE'
      and tc.table_schema = 'public'
      and tc.table_name in ('leads', 'contacts')
    group by tc.constraint_name, tc.table_name
    having array_agg(kcu.column_name) = array['amocrm_id']
  loop
    execute format('alter table public.%I drop constraint %I', r.table_name, r.constraint_name);
  end loop;
end $$;

-- 2) Dedupe contacts first (leads reference contacts, not the other way
--    around), then leads.
create temporary table contact_winner as
select id, organization_id, amocrm_id,
       first_value(id) over (
         partition by organization_id, amocrm_id
         order by updated_at desc, id desc
       ) as winner_id
from public.contacts
where amocrm_id is not null;

do $$
declare
  r record;
begin
  for r in
    select tc.table_name, kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
    join information_schema.constraint_column_usage ccu
      on tc.constraint_name = ccu.constraint_name and tc.table_schema = ccu.table_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = 'public'
      and ccu.table_schema = 'public'
      and ccu.table_name = 'contacts'
  loop
    execute format(
      'update public.%I t set %I = w.winner_id from contact_winner w where t.%I = w.id and w.id <> w.winner_id',
      r.table_name, r.column_name, r.column_name
    );
  end loop;
end $$;

delete from public.contacts where id in (select id from contact_winner where id <> winner_id);

create temporary table lead_winner as
select id, organization_id, amocrm_id,
       first_value(id) over (
         partition by organization_id, amocrm_id
         order by updated_at desc, id desc
       ) as winner_id
from public.leads
where amocrm_id is not null;

do $$
declare
  r record;
begin
  for r in
    select tc.table_name, kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
    join information_schema.constraint_column_usage ccu
      on tc.constraint_name = ccu.constraint_name and tc.table_schema = ccu.table_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = 'public'
      and ccu.table_schema = 'public'
      and ccu.table_name = 'leads'
  loop
    execute format(
      'update public.%I t set %I = w.winner_id from lead_winner w where t.%I = w.id and w.id <> w.winner_id',
      r.table_name, r.column_name, r.column_name
    );
  end loop;
end $$;

delete from public.leads where id in (select id from lead_winner where id <> winner_id);

-- 3) Re-add the composite unique constraints the sync's upserts target,
--    so duplicates like this can't accumulate again.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_org_amocrm_id_key') then
    alter table public.leads add constraint leads_org_amocrm_id_key unique (organization_id, amocrm_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contacts_org_amocrm_id_key') then
    alter table public.contacts add constraint contacts_org_amocrm_id_key unique (organization_id, amocrm_id);
  end if;
end $$;

commit;

select 'leads' as t, count(*) from public.leads
union all select 'contacts', count(*) from public.contacts
union all select 'companies', count(*) from public.companies
union all select 'pipeline_stages', count(*) from public.pipeline_stages;
