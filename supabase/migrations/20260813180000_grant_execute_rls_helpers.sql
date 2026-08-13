-- 20260809050721 revoked EXECUTE on these helper functions from
-- anon/authenticated/public as a hardening measure, but is_admin_or_manager()
-- and current_user_role() are called directly inside RLS policy USING/WITH
-- CHECK expressions (e.g. profiles_update_self_or_admin) — a role
-- evaluating a policy that calls a function needs EXECUTE on that function
-- itself, regardless of the function being SECURITY DEFINER. Without it,
-- every RLS-gated action that depends on these (a super_admin editing
-- someone else's role, department, or manager_id; anything gating on
-- current_user_role()) has been failing with "permission denied for
-- function ..." since that revoke — silently, because the app's error
-- toasts were falling back to a generic message instead of showing it
-- (see the describeError() fix). handle_new_user/prevent_role_self_escalation/
-- set_updated_at stay revoked — those only ever run as trigger functions,
-- which don't need direct EXECUTE from the invoking role.
grant execute on function public.is_admin_or_manager() to authenticated;
grant execute on function public.current_user_role() to authenticated;
