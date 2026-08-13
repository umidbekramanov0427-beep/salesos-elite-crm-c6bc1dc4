-- Root cause of every AmoCRM sync failing with "ON CONFLICT DO UPDATE
-- command cannot affect row a second time": pipeline_stages was upserted
-- with onConflict targeting (organization_id, amocrm_status_id) alone, but
-- AmoCRM reuses status ids 142 (won) and 143 (lost) in *every* pipeline —
-- they are not globally unique within an account. Any org with 2+
-- pipelines produced two rows sharing the same amocrm_status_id in the
-- same upsert batch, which Postgres rejects outright. The fix widens the
-- uniqueness to (organization_id, amocrm_pipeline_id, amocrm_status_id).
--
-- This drops whichever form the old constraint/index takes (named
-- constraint or bare unique index — it was added ad hoc, not through a
-- tracked migration, so the exact name isn't known here) and replaces it.
do $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class t on t.oid = con.conrelid
    where t.relname = 'pipeline_stages'
      and con.contype = 'u'
      and (
        select array_agg(att.attname::text order by att.attname)
        from unnest(con.conkey) as k(attnum)
        join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k.attnum
      ) = array['amocrm_status_id', 'organization_id']
  loop
    execute format('alter table public.pipeline_stages drop constraint %I', r.conname);
  end loop;

  for r in
    select ic.relname as indexname
    from pg_index i
    join pg_class ic on ic.oid = i.indexrelid
    join pg_class t on t.oid = i.indrelid
    where t.relname = 'pipeline_stages'
      and i.indisunique
      and not exists (select 1 from pg_constraint c where c.conindid = i.indexrelid)
      and (
        select array_agg(att.attname::text order by att.attname)
        from unnest(i.indkey::int[]) as k(attnum)
        join pg_attribute att on att.attrelid = i.indrelid and att.attnum = k.attnum
        where k.attnum > 0
      ) = array['amocrm_status_id', 'organization_id']
  loop
    execute format('drop index public.%I', r.indexname);
  end loop;
end $$;

alter table public.pipeline_stages
  drop constraint if exists pipeline_stages_org_pipeline_status_key;
alter table public.pipeline_stages
  add constraint pipeline_stages_org_pipeline_status_key
  unique (organization_id, amocrm_pipeline_id, amocrm_status_id);
