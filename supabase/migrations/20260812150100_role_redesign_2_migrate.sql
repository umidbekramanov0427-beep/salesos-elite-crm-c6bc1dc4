-- Role redesign step 2 of 2: run this only after
-- 20260812150000_role_redesign_1_add_enum_values.sql has been run and
-- committed (Postgres won't let a new enum value be used in the same
-- transaction it was added in).
--
-- Renames the role system from super_admin/manager/rep to
-- super_admin/rop/sotuv_menejeri. 'manager' and 'rep' stay in the
-- app_role enum (Postgres can't drop enum values without a full type
-- rebuild) but nothing references them anymore after this migration.
--
-- Design note on RLS scope: leads/deals/amocrm_calls SELECT policies are
-- deliberately left as-is (organization-wide, unchanged) rather than
-- tightened to owner-only at the DB layer. The Reyting/leaderboard page
-- needs every teammate's lead data to compute company-wide rankings, so a
-- DB-level owner-only restriction would break it outright. "Sotuv
-- menejeri sees only their own data" (Dashboard, Funnels detail, AmoCRM
-- board, Audio tahlil) and "ROP sees only their team" are enforced at the
-- client-hook layer instead, extending the exact scoping pattern already
-- used for the old 'rep' role in useCrmBase() (src/hooks/use-crm-data.ts)
-- to the two new roles. That is the same trust model this app already
-- ships with for org-mates, just applied consistently going forward.

-- 1. Migrate every existing row to the new roles. The role-change guard
--    trigger only allows a super_admin *session* to change roles — this
--    migration runs from the SQL editor with no auth.uid(), so disable the
--    trigger for this one bulk update, same as the "promote the operator"
--    migration (20260811080000) did for the same reason.
alter table public.profiles disable trigger guard_role_escalation;
update public.profiles set role = 'rop' where role = 'manager';
update public.profiles set role = 'sotuv_menejeri' where role = 'rep';
alter table public.profiles enable trigger guard_role_escalation;

-- 2. Redefine is_admin_or_manager() to check the new admin-ish roles.
--    Keeping the function name avoids touching every policy that already
--    calls it (leads_update/delete, deals_update/delete, audit_logs_select,
--    ai_agents/auto_responders write policies, profiles_select, etc).
create or replace function public.is_admin_or_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()) in ('super_admin', 'rop'), false);
$$;

-- 3. handle_new_user(): accept the new roles, default fallback becomes
--    sotuv_menejeri (was rep) so a role-less account still isn't admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta_role text := new.raw_user_meta_data ->> 'role';
  meta_org text := new.raw_user_meta_data ->> 'organization_id';
begin
  insert into public.profiles (id, email, full_name, role, organization_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case
      when meta_role in ('super_admin', 'rop', 'sotuv_menejeri') then meta_role::public.app_role
      else 'sotuv_menejeri'::public.app_role
    end,
    nullif(meta_org, '')::uuid
  )
  on conflict (id) do nothing;
  return new;
end; $$;

-- 4. profiles_select: today a non-admin/manager can only read their own
--    row, which silently breaks Reyting (it needs every teammate's name/
--    avatar/kpi/target to build the ranking). leads/deals are already
--    org-wide readable by everyone, so making profiles org-wide readable
--    too just closes an inconsistency, not a new trust boundary.
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or organization_id = public.current_user_org_id()
    or public.is_platform_owner()
  );

-- 5. Fix two pre-existing RLS bugs on the exact surface this migration is
--    already touching: migration 20260811174705 re-added overly-broad
--    "FOR ALL ... USING (organization_id = ...)" policies on ai_agents and
--    auto_responders (no role check at all, stacking as an OR alongside
--    the correct super_admin-only policies and granting every org member
--    full read/write on those tables), and reintroduced a
--    "USING (true)" SELECT policy on notification_preferences (undoing
--    the same-org fix from 20260811080000). Dropping all three restores
--    the intended restrictions.
drop policy if exists "Company members manage AI agents" on public.ai_agents;
drop policy if exists "Company members manage auto responders" on public.auto_responders;
drop policy if exists "Signed-in users can read notification preferences" on public.notification_preferences;
