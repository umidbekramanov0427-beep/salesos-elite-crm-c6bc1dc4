-- Deleting an empty organization via delete_organization_data() timed out
-- ("canceling statement due to statement timeout") even though the target
-- org had zero rows anywhere -- because several tables have no index on
-- organization_id, so every `delete ... where organization_id = ...` (and
-- every RLS-filtered select on these tables, on every page load) forces a
-- full sequential scan of the whole table, not just the target org's rows.
-- With another organization actively syncing thousands of AmoCRM calls/
-- activities into these same tables, that scan is exactly what timed out.
create index if not exists audit_logs_org_idx on public.audit_logs (organization_id);
create index if not exists work_sessions_org_idx on public.work_sessions (organization_id);
create index if not exists call_logs_org_idx on public.call_logs (organization_id);
create index if not exists task_comments_org_idx on public.task_comments (organization_id);
create index if not exists error_logs_org_idx on public.error_logs (organization_id);
create index if not exists auto_responders_org_idx on public.auto_responders (organization_id);
