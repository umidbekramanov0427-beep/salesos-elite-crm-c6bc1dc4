-- audit_logs had grown to ~5.8 million rows (~9.6 GB) in 15 days, degrading
-- the whole database -- even trivial reads against unrelated tables were
-- failing. Root cause: audit_row_change() (a trigger applied to leads,
-- deals, amocrm_calls, companies, contacts, tasks, work_sessions,
-- call_logs, pipeline_stages, profiles -- created directly against the
-- live database at some point, with no corresponding migration file in
-- this repo) logs a full row snapshot on every single UPDATE
-- unconditionally, even when nothing actually changed. The AmoCRM sync
-- re-writes every synced row on every 5-minute tick regardless of whether
-- its data changed, so this generated a snapshot per row per tick,
-- multiplied across thousands of leads for weeks.
--
-- Skip the insert when an UPDATE didn't actually change anything -- every
-- real change is still logged exactly as before.
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_entity_id uuid;
  v_meta jsonb;
begin
  if tg_op = 'UPDATE' and to_jsonb(old) = to_jsonb(new) then
    return new;
  end if;

  if tg_op = 'DELETE' then
    v_org := old.organization_id;
    v_entity_id := old.id;
    v_meta := jsonb_build_object('old', to_jsonb(old));
  elsif tg_op = 'INSERT' then
    v_org := new.organization_id;
    v_entity_id := new.id;
    v_meta := jsonb_build_object('new', to_jsonb(new));
  else
    v_org := coalesce(new.organization_id, old.organization_id);
    v_entity_id := new.id;
    v_meta := jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new));
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, meta, organization_id)
  values (auth.uid(), lower(tg_op), tg_table_name, v_entity_id, v_meta, v_org);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
