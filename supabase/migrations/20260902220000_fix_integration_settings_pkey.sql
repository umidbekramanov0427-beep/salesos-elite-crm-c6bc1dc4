-- integration_settings was supposed to move from a single-column primary
-- key (key) to a composite one (organization_id, key) back when the table
-- went multi-tenant (20260811070000_multi_tenant_singletons.sql), so every
-- organization could have its own row per integration key. That change
-- never actually took effect on this database -- the key-only primary key
-- was still live, so any second organization trying to insert its own row
-- for a key another org already used (e.g. 'amocrm') hit a duplicate-key
-- error, and a plain .update() against a non-existent (org, key) pair
-- silently matched zero rows instead. This is what blocked per-organization
-- AmoCRM credentials from ever being saved for a second company.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.integration_settings'::regclass
      and contype = 'p'
      and pg_get_constraintdef(oid) = 'PRIMARY KEY (key)'
  ) then
    alter table public.integration_settings drop constraint integration_settings_pkey;
    alter table public.integration_settings add primary key (organization_id, key);
  end if;
end $$;
