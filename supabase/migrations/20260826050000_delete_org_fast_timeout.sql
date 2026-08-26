-- Deleting an organization was hanging for ~90s and then failing with an
-- opaque "upstream request timeout" from the hosting platform's own
-- gateway -- even for a completely empty org, and even after adding the
-- missing organization_id indexes. pg_stat_activity showed no matching
-- query running in Postgres during the hang, which points at the request
-- queueing for a pooled connection (most likely held by the AmoCRM sync
-- cron) rather than a slow query once it starts.
--
-- Give the function its own short statement_timeout so that if any single
-- delete inside it genuinely can't proceed quickly, it fails fast with a
-- clear Postgres error instead of silently hanging until an unrelated
-- platform-level gateway timeout kicks in with no diagnostic information.
create or replace function public.delete_organization_data(target_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  set local statement_timeout = '8s';

  delete from public.task_comments where organization_id = target_org_id;
  delete from public.lead_activities where organization_id = target_org_id;
  delete from public.tasks where organization_id = target_org_id;
  delete from public.amocrm_calls where organization_id = target_org_id;
  delete from public.call_logs where organization_id = target_org_id;
  delete from public.work_sessions where organization_id = target_org_id;
  delete from public.notifications where organization_id = target_org_id;
  delete from public.audit_logs where organization_id = target_org_id;
  delete from public.error_logs where organization_id = target_org_id;
  delete from public.deals where organization_id = target_org_id;
  delete from public.leads where organization_id = target_org_id;
  delete from public.contacts where organization_id = target_org_id;
  delete from public.companies where organization_id = target_org_id;
  delete from public.pipeline_stages where organization_id = target_org_id;
  delete from public.auto_responders where organization_id = target_org_id;
  delete from public.ai_agents where organization_id = target_org_id;
  delete from public.business_profile where organization_id = target_org_id;
  delete from public.integration_settings where organization_id = target_org_id;
  delete from public.amocrm_connection where organization_id = target_org_id;
  delete from public.organizations where id = target_org_id;
end;
$$;
