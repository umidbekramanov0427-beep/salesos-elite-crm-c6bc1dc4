-- Same class of bug as 20260902220000_fix_integration_settings_pkey.sql,
-- on the table that actually stores AmoCRM access/refresh tokens: the
-- 2026-08-11 multi-tenant migration meant to drop amocrm_connection's old
-- boolean singleton primary key (id, always true) and replace it with
-- organization_id, but that drop never took effect on the live database.
-- The old `id boolean primary key default true` (plus its `check (id)`
-- singleton constraint) was still live, with organization_id merely
-- unique-indexed alongside it -- so the table could only ever hold ONE
-- row total. Every org's upsert on connect defaulted to the same id=true
-- row, so a second organization connecting AmoCRM silently overwrote and
-- replaced the first organization's access/refresh tokens outright.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.amocrm_connection'::regclass
      and contype = 'p'
      and pg_get_constraintdef(oid) = 'PRIMARY KEY (id)'
  ) then
    alter table public.amocrm_connection drop constraint if exists amocrm_connection_singleton;
    alter table public.amocrm_connection drop constraint amocrm_connection_pkey;
    alter table public.amocrm_connection drop column id;
    alter table public.amocrm_connection add primary key (organization_id);
    drop index if exists public.amocrm_connection_org_idx;
  end if;
end $$;
