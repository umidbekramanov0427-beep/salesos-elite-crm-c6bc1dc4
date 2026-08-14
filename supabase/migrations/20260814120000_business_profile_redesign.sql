-- Richer Business Profile: value proposition, target customer, qualified-lead
-- definition, structured products/services, objections and glossary lists,
-- and a proper competitors list — additive only, existing columns untouched
-- so the Telegram onboarding bot (which still writes the original 5 fields)
-- keeps working unchanged.
alter table public.business_profile
  add column if not exists value_proposition text not null default '',
  add column if not exists target_customer text not null default '',
  add column if not exists qualified_lead_definition text not null default '',
  add column if not exists products_services jsonb not null default '[]'::jsonb,
  add column if not exists objections jsonb not null default '[]'::jsonb,
  add column if not exists glossary jsonb not null default '[]'::jsonb,
  add column if not exists competitors_list text[] not null default '{}'::text[];
