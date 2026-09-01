-- Replaces the old "paste a wall of text" Tashkiliy tuzilma shelf with a
-- real hierarchy: one row per role/position, optionally linked to a parent
-- role, rendered as a connected org chart instead of a generic document
-- card. parent_id uses ON DELETE SET NULL (not CASCADE) so deleting a role
-- detaches its subordinates to the top level instead of wiping the whole
-- branch underneath it.
create table if not exists public.org_structure_nodes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  parent_id uuid references public.org_structure_nodes(id) on delete set null,
  title text not null,
  subtitle text not null default '',
  responsibilities text not null default '',
  position integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists org_structure_nodes_org_idx
  on public.org_structure_nodes (organization_id);
create index if not exists org_structure_nodes_parent_idx
  on public.org_structure_nodes (parent_id);

alter table public.org_structure_nodes enable row level security;

drop trigger if exists set_org_id on public.org_structure_nodes;
create trigger set_org_id before insert on public.org_structure_nodes
  for each row execute function public.set_organization_id();

drop trigger if exists set_updated_at on public.org_structure_nodes;
create trigger set_updated_at before update on public.org_structure_nodes
  for each row execute function public.set_updated_at();

-- Everyone in the org can view the chart; only super_admin can edit it,
-- same split as the rest of the content library.
drop policy if exists "org_structure_nodes_select" on public.org_structure_nodes;
create policy "org_structure_nodes_select" on public.org_structure_nodes
  for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "org_structure_nodes_write" on public.org_structure_nodes;
create policy "org_structure_nodes_write" on public.org_structure_nodes
  for all to authenticated
  using (organization_id = public.current_user_org_id() and public.current_user_role() = 'super_admin')
  with check (organization_id = public.current_user_org_id() and public.current_user_role() = 'super_admin');
