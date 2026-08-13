-- Owner (Platform) panel CRUD: the platform owner could only create a
-- company and deactivate/edit it — no way to delete a user, add a user to
-- an existing company, or delete a company outright. This adds the
-- server-side piece for all three (routes call these directly).
--
-- Deleting a company is destructive and irreversible: every lead, deal,
-- contact, task, call, audit entry etc. that belongs to it is gone for
-- good, and so is every one of its user accounts. None of the
-- organization_id foreign keys added across earlier migrations actually
-- cascade (every "ON DELETE CASCADE" on an already-existing column was a
-- no-op — ALTER TABLE ... ADD COLUMN IF NOT EXISTS ... REFERENCES silently
-- skips the whole clause, cascade included, once the column already
-- exists), so a plain `delete from organizations` would just fail on the
-- first foreign key it hits. This function deletes every dependent row
-- itself, in one transaction, then the organization row last.
--
-- User accounts (auth.users, whose deletion cascades to profiles) are
-- deleted separately, from the calling server route via the Auth Admin
-- API — not from inside this SQL function — since that's the
-- already-proven path (same one admin.delete-employee.ts uses) and this
-- function's owner shouldn't need auth-schema privileges it doesn't
-- otherwise have.
create or replace function public.delete_organization_data(target_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
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

-- Only the server (service-role) may call this — it has no auth.uid()-based
-- authorization check of its own, since the calling route
-- (platform.delete-organization.ts) already requires a platform_owner
-- session before it ever runs.
revoke all on function public.delete_organization_data(uuid) from public, anon, authenticated;
grant execute on function public.delete_organization_data(uuid) to service_role;
