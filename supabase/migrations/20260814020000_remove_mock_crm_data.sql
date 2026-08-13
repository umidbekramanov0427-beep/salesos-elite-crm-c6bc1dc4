-- Removes leftover demo/mock CRM records so only AmoCRM-synced data
-- remains: pipeline_stages rows never synced from AmoCRM
-- (amocrm_pipeline_id is null -- the original seed stages like "New
-- Lead"/"Qualified"/"Demo"/"Proposal"/"Negotiation"), and leads/
-- contacts/companies rows never synced from AmoCRM (amocrm_id is null).
--
-- For each of these, every foreign key elsewhere in the schema that
-- points at a row being removed is handled first: set to null if the
-- column is optional (e.g. leads.company_id), or the referencing row is
-- deleted if the column is required (e.g. lead_activities.lead_id, an
-- activity log entry that can't exist without its lead). Order matters:
-- stages, then companies, then contacts, then leads, since leads/deals
-- reference all three of the others.
--
-- Safe to re-run -- once nothing has a null amocrm_id/amocrm_pipeline_id
-- left, every step below is a no-op.

do $$
declare
  r record;
  col_is_nullable boolean;
begin
  -- ---------------------------------------------------------------
  -- pipeline_stages: rows never synced from AmoCRM.
  -- ---------------------------------------------------------------
  create temporary table mock_stage_ids as
    select id from public.pipeline_stages where amocrm_pipeline_id is null;

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
      and ccu.table_name = 'pipeline_stages'
  loop
    select (c.is_nullable = 'YES') into col_is_nullable
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = r.table_name and c.column_name = r.column_name;

    if col_is_nullable then
      execute format(
        'update public.%I set %I = null where %I in (select id from mock_stage_ids)',
        r.table_name, r.column_name, r.column_name
      );
    else
      execute format(
        'delete from public.%I where %I in (select id from mock_stage_ids)',
        r.table_name, r.column_name
      );
    end if;
  end loop;

  delete from public.pipeline_stages where id in (select id from mock_stage_ids);
  drop table mock_stage_ids;

  -- ---------------------------------------------------------------
  -- companies: rows never synced from AmoCRM.
  -- ---------------------------------------------------------------
  create temporary table mock_company_ids as
    select id from public.companies where amocrm_id is null;

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
      and ccu.table_name = 'companies'
  loop
    select (c.is_nullable = 'YES') into col_is_nullable
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = r.table_name and c.column_name = r.column_name;

    if col_is_nullable then
      execute format(
        'update public.%I set %I = null where %I in (select id from mock_company_ids)',
        r.table_name, r.column_name, r.column_name
      );
    else
      execute format(
        'delete from public.%I where %I in (select id from mock_company_ids)',
        r.table_name, r.column_name
      );
    end if;
  end loop;

  delete from public.companies where id in (select id from mock_company_ids);
  drop table mock_company_ids;

  -- ---------------------------------------------------------------
  -- contacts: rows never synced from AmoCRM.
  -- ---------------------------------------------------------------
  create temporary table mock_contact_ids as
    select id from public.contacts where amocrm_id is null;

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
    select (c.is_nullable = 'YES') into col_is_nullable
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = r.table_name and c.column_name = r.column_name;

    if col_is_nullable then
      execute format(
        'update public.%I set %I = null where %I in (select id from mock_contact_ids)',
        r.table_name, r.column_name, r.column_name
      );
    else
      execute format(
        'delete from public.%I where %I in (select id from mock_contact_ids)',
        r.table_name, r.column_name
      );
    end if;
  end loop;

  delete from public.contacts where id in (select id from mock_contact_ids);
  drop table mock_contact_ids;

  -- ---------------------------------------------------------------
  -- leads: rows never synced from AmoCRM.
  -- ---------------------------------------------------------------
  create temporary table mock_lead_ids as
    select id from public.leads where amocrm_id is null;

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
    select (c.is_nullable = 'YES') into col_is_nullable
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = r.table_name and c.column_name = r.column_name;

    if col_is_nullable then
      execute format(
        'update public.%I set %I = null where %I in (select id from mock_lead_ids)',
        r.table_name, r.column_name, r.column_name
      );
    else
      execute format(
        'delete from public.%I where %I in (select id from mock_lead_ids)',
        r.table_name, r.column_name
      );
    end if;
  end loop;

  delete from public.leads where id in (select id from mock_lead_ids);
  drop table mock_lead_ids;
end $$;

select 'leads' as t, count(*) from public.leads
union all select 'contacts', count(*) from public.contacts
union all select 'companies', count(*) from public.companies
union all select 'pipeline_stages', count(*) from public.pipeline_stages
union all select 'deals', count(*) from public.deals;
