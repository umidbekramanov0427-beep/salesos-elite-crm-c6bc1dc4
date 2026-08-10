-- amocrm_id/amocrm_note_id were unique across the whole table, but an
-- AmoCRM id is only actually unique **within one AmoCRM account**. Now
-- that different companies each connect their own independent AmoCRM
-- account, two companies could easily reuse the same small ids — with a
-- table-wide unique constraint, syncing company B could silently upsert
-- straight over company A's lead/call. Scope uniqueness to the owning
-- organization instead.
alter table public.leads drop constraint leads_amocrm_id_key;
alter table public.leads add constraint leads_org_amocrm_id_key unique (organization_id, amocrm_id);

alter table public.contacts drop constraint contacts_amocrm_id_key;
alter table public.contacts
  add constraint contacts_org_amocrm_id_key unique (organization_id, amocrm_id);

alter table public.companies drop constraint companies_amocrm_id_key;
alter table public.companies
  add constraint companies_org_amocrm_id_key unique (organization_id, amocrm_id);

alter table public.amocrm_calls drop constraint amocrm_calls_amocrm_note_id_key;
alter table public.amocrm_calls
  add constraint amocrm_calls_org_note_id_key unique (organization_id, amocrm_note_id);

-- Same issue for pipeline_stages.key ('new', 'won', 'lost', ...) — every
-- organization needs its own 'new'/'won'/etc. stage, which a table-wide
-- unique constraint would block after the very first organization.
alter table public.pipeline_stages drop constraint pipeline_stages_key_key;
alter table public.pipeline_stages
  add constraint pipeline_stages_org_key_key unique (organization_id, key);
