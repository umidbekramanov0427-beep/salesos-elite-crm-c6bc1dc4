-- Lets an admin pick exactly which AmoCRM pipelines (voronkalar) and users
-- (operatorlar) actually get synced, instead of always pulling every
-- pipeline/user in the connected account (58 pipelines for this account,
-- many of them old/test funnels the org doesn't want in the CRM). NULL on
-- either column means "sync everything" (the previous, unrestricted
-- behavior) so existing connections keep working unchanged until an admin
-- explicitly narrows the selection.
alter table public.amocrm_connection
  add column if not exists enabled_pipeline_ids integer[],
  add column if not exists enabled_user_ids integer[];
