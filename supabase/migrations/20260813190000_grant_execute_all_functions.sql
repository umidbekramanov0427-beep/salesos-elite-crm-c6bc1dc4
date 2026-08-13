-- Blanket-fixes the "permission denied for function X" class of bug.
-- 20260809050721_...sql revoked EXECUTE from authenticated on 5 named
-- RLS-helper functions; every migration since then that added a *new*
-- security-definer helper (is_platform_owner, current_user_org_id, ...)
-- never got an explicit grant either, since it postdates that revoke.
-- RLS policies evaluate these functions in the querying session's own
-- privilege context, not the definer's, so any gap here silently breaks
-- reads/writes on whatever table the policy guards. Grant broadly across
-- every function in public instead of patching one function per bug
-- report, and set default privileges so this can't recur for functions
-- added later.
do $$
declare
  r record;
begin
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('grant execute on function public.%I(%s) to authenticated', r.proname, r.args);
  end loop;
end $$;

alter default privileges in schema public grant execute on functions to authenticated;
