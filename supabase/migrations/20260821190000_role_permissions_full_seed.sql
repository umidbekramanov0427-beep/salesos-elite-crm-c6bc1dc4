-- Admin > Huquqlar jadvali (PermissionsTable.tsx) has always listed 8
-- categories / ~33 actions (leads, pipeline, tasks, reports, audio,
-- leaderboard, ai, admin), but the role_permissions table (and its
-- seed_new_organization insert) was only ever populated with the 7 "leads"
-- actions -- every other action showed as unchecked/denied by default for
-- rop/sotuv_menejeri simply because no row existed yet, not because an
-- admin ever chose to restrict it.
--
-- This became a real regression today: crm.pipeline.tsx was just gated
-- behind usePermission("Move deals") and usePermission("View revenue"),
-- both previously ungated (always visible/usable). With no seeded row for
-- either action, every rop/sotuv_menejeri user is now silently blocked
-- from moving deals and seeing revenue on the AmoCRM board until an admin
-- happens to open Huquqlar jadvali and turn them on manually.
--
-- Backfills sensible defaults for every action PermissionsTable.tsx
-- already lists but role_permissions never seeded, for every existing org,
-- and extends seed_new_organization() so future orgs get the same set.
-- Defaults follow the same philosophy the original "leads" seed already
-- established: rop allowed on routine actions, restricted on destructive
-- ones (delete); sotuv_menejeri further restricted on assign/export/manage
-- actions. "Move deals"/"View revenue" default to true specifically to
-- restore the pre-gate behavior rather than silently narrow it.
insert into public.role_permissions (organization_id, role, action, allowed)
select o.id, v.role, v.action, v.allowed
from public.organizations o
cross join (values
  ('rop', 'View pipeline', true),
  ('rop', 'Move deals', true),
  ('rop', 'Create deals', true),
  ('rop', 'Delete deals', false),
  ('rop', 'View revenue', true),
  ('rop', 'View tasks', true),
  ('rop', 'Create tasks', true),
  ('rop', 'Assign tasks', true),
  ('rop', 'Delete tasks', false),
  ('rop', 'Complete tasks', true),
  ('rop', 'View reports', true),
  ('rop', 'Export reports', true),
  ('rop', 'View recordings', true),
  ('rop', 'AI call analysis', true),
  ('rop', 'Delete recordings', false),
  ('rop', 'View leaderboard', true),
  ('rop', 'View revenue data', true),
  ('rop', 'View bonuses', true),
  ('rop', 'Use AI assistant', true),
  ('rop', 'Generate messages', true),
  ('rop', 'View admin panel', false),
  ('rop', 'Manage users', false),
  ('rop', 'Manage permissions', false),
  ('rop', 'Manage integrations', false),
  ('sotuv_menejeri', 'View pipeline', true),
  ('sotuv_menejeri', 'Move deals', true),
  ('sotuv_menejeri', 'Create deals', true),
  ('sotuv_menejeri', 'Delete deals', false),
  ('sotuv_menejeri', 'View revenue', true),
  ('sotuv_menejeri', 'View tasks', true),
  ('sotuv_menejeri', 'Create tasks', true),
  ('sotuv_menejeri', 'Assign tasks', false),
  ('sotuv_menejeri', 'Delete tasks', false),
  ('sotuv_menejeri', 'Complete tasks', true),
  ('sotuv_menejeri', 'View reports', true),
  ('sotuv_menejeri', 'Export reports', false),
  ('sotuv_menejeri', 'View recordings', true),
  ('sotuv_menejeri', 'AI call analysis', true),
  ('sotuv_menejeri', 'Delete recordings', false),
  ('sotuv_menejeri', 'View leaderboard', true),
  ('sotuv_menejeri', 'View revenue data', true),
  ('sotuv_menejeri', 'View bonuses', true),
  ('sotuv_menejeri', 'Use AI assistant', true),
  ('sotuv_menejeri', 'Generate messages', true),
  ('sotuv_menejeri', 'View admin panel', false),
  ('sotuv_menejeri', 'Manage users', false),
  ('sotuv_menejeri', 'Manage permissions', false),
  ('sotuv_menejeri', 'Manage integrations', false)
) as v(role, action, allowed)
on conflict (organization_id, role, action) do nothing;

create or replace function public.seed_new_organization()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.pipeline_stages (key, name, position, color, probability, is_won, is_lost, organization_id) values
    ('new', 'New Lead', 1, 'bg-primary', 10, false, false, new.id),
    ('qualified', 'Qualified', 2, 'bg-info', 25, false, false, new.id),
    ('demo', 'Demo', 3, 'bg-warning', 45, false, false, new.id),
    ('proposal', 'Proposal', 4, 'bg-mint-border', 65, false, false, new.id),
    ('negotiation', 'Negotiation', 5, 'bg-success', 85, false, false, new.id),
    ('won', 'Won', 6, 'bg-success', 100, true, false, new.id),
    ('lost', 'Lost', 7, 'bg-destructive', 0, false, true, new.id);

  insert into public.integration_settings (organization_id, key, enabled, config) values
    (new.id, 'openai', false, '{}'),
    (new.id, 'telegram', false, '{}'),
    (new.id, 'whatsapp', false, '{}'),
    (new.id, 'amocrm', false, '{}'),
    (new.id, 'telegram_bot', false, '{}');

  insert into public.business_profile (organization_id) values (new.id);

  insert into public.ai_agents (organization_id, kind) values
    (new.id, 'chat'),
    (new.id, 'call');

  insert into public.role_permissions (organization_id, role, action, allowed) values
    (new.id, 'super_admin', 'View leads', true),
    (new.id, 'super_admin', 'Edit leads', true),
    (new.id, 'super_admin', 'Delete leads', true),
    (new.id, 'super_admin', 'Export leads', true),
    (new.id, 'super_admin', 'Assign leads', true),
    (new.id, 'super_admin', 'Merge leads', true),
    (new.id, 'super_admin', 'Restore leads', true),
    (new.id, 'rop', 'View leads', true),
    (new.id, 'rop', 'Edit leads', true),
    (new.id, 'rop', 'Delete leads', false),
    (new.id, 'rop', 'Export leads', true),
    (new.id, 'rop', 'Assign leads', true),
    (new.id, 'rop', 'Merge leads', false),
    (new.id, 'rop', 'Restore leads', false),
    (new.id, 'rop', 'View pipeline', true),
    (new.id, 'rop', 'Move deals', true),
    (new.id, 'rop', 'Create deals', true),
    (new.id, 'rop', 'Delete deals', false),
    (new.id, 'rop', 'View revenue', true),
    (new.id, 'rop', 'View tasks', true),
    (new.id, 'rop', 'Create tasks', true),
    (new.id, 'rop', 'Assign tasks', true),
    (new.id, 'rop', 'Delete tasks', false),
    (new.id, 'rop', 'Complete tasks', true),
    (new.id, 'rop', 'View reports', true),
    (new.id, 'rop', 'Export reports', true),
    (new.id, 'rop', 'View recordings', true),
    (new.id, 'rop', 'AI call analysis', true),
    (new.id, 'rop', 'Delete recordings', false),
    (new.id, 'rop', 'View leaderboard', true),
    (new.id, 'rop', 'View revenue data', true),
    (new.id, 'rop', 'View bonuses', true),
    (new.id, 'rop', 'Use AI assistant', true),
    (new.id, 'rop', 'Generate messages', true),
    (new.id, 'rop', 'View admin panel', false),
    (new.id, 'rop', 'Manage users', false),
    (new.id, 'rop', 'Manage permissions', false),
    (new.id, 'rop', 'Manage integrations', false),
    (new.id, 'sotuv_menejeri', 'View leads', true),
    (new.id, 'sotuv_menejeri', 'Edit leads', true),
    (new.id, 'sotuv_menejeri', 'Delete leads', false),
    (new.id, 'sotuv_menejeri', 'Export leads', false),
    (new.id, 'sotuv_menejeri', 'Assign leads', false),
    (new.id, 'sotuv_menejeri', 'Merge leads', false),
    (new.id, 'sotuv_menejeri', 'Restore leads', false),
    (new.id, 'sotuv_menejeri', 'View pipeline', true),
    (new.id, 'sotuv_menejeri', 'Move deals', true),
    (new.id, 'sotuv_menejeri', 'Create deals', true),
    (new.id, 'sotuv_menejeri', 'Delete deals', false),
    (new.id, 'sotuv_menejeri', 'View revenue', true),
    (new.id, 'sotuv_menejeri', 'View tasks', true),
    (new.id, 'sotuv_menejeri', 'Create tasks', true),
    (new.id, 'sotuv_menejeri', 'Assign tasks', false),
    (new.id, 'sotuv_menejeri', 'Delete tasks', false),
    (new.id, 'sotuv_menejeri', 'Complete tasks', true),
    (new.id, 'sotuv_menejeri', 'View reports', true),
    (new.id, 'sotuv_menejeri', 'Export reports', false),
    (new.id, 'sotuv_menejeri', 'View recordings', true),
    (new.id, 'sotuv_menejeri', 'AI call analysis', true),
    (new.id, 'sotuv_menejeri', 'Delete recordings', false),
    (new.id, 'sotuv_menejeri', 'View leaderboard', true),
    (new.id, 'sotuv_menejeri', 'View revenue data', true),
    (new.id, 'sotuv_menejeri', 'View bonuses', true),
    (new.id, 'sotuv_menejeri', 'Use AI assistant', true),
    (new.id, 'sotuv_menejeri', 'Generate messages', true),
    (new.id, 'sotuv_menejeri', 'View admin panel', false),
    (new.id, 'sotuv_menejeri', 'Manage users', false),
    (new.id, 'sotuv_menejeri', 'Manage permissions', false),
    (new.id, 'sotuv_menejeri', 'Manage integrations', false);

  return new;
end; $$;
