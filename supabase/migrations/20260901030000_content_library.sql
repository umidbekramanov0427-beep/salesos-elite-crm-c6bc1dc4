-- "Hujjat va Darsliklar" -- a shared, org-wide content library everyone can
-- view but only super_admin can add to: company info/docs/links (with
-- dedicated sub-areas for org structure and regulations/guidelines) plus a
-- video/file training-materials library. Follows the exact same bucket +
-- RLS shape as call-recordings/hr-chat-attachments (public bucket, path-
-- scoped by uploader) and the same singleton-settings RLS shape as
-- security_settings (read: any org member or platform owner; write:
-- super_admin only).
insert into storage.buckets (id, name, public)
values ('content-library', 'content-library', true)
on conflict (id) do nothing;

drop policy if exists "content_library_insert" on storage.objects;
create policy "content_library_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'content-library' and public.current_user_role() = 'super_admin');

drop policy if exists "content_library_delete" on storage.objects;
create policy "content_library_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'content-library' and public.current_user_role() = 'super_admin');

drop policy if exists "content_library_read" on storage.objects;
create policy "content_library_read" on storage.objects
  for select to public
  using (bucket_id = 'content-library');

create table if not exists public.content_library_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- about_general: company/campaign info, docs, links, images -- the
  -- freeform "Biz haqimizda" shelf.
  -- about_org_structure / about_regulation: their own dedicated shelves
  -- inside the same tab, per the explicit request for separate spots.
  -- training: the video/file lesson library (sales, marketing, management,
  -- sales-technique training).
  section text not null check (
    section in ('about_general', 'about_org_structure', 'about_regulation', 'training')
  ),
  title text not null,
  description text not null default '',
  item_type text not null check (item_type in ('link', 'file', 'image', 'video', 'audio', 'document')),
  url text not null,
  -- The storage object path (when item_type isn't 'link') -- kept so a
  -- future delete can also remove the underlying file, not just the row.
  file_path text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_library_items_org_section_idx
  on public.content_library_items (organization_id, section, created_at desc);

alter table public.content_library_items enable row level security;

drop policy if exists "content_library_items_select" on public.content_library_items;
create policy "content_library_items_select" on public.content_library_items
  for select to authenticated
  using (organization_id = public.current_user_org_id() or public.is_platform_owner());

drop policy if exists "content_library_items_write" on public.content_library_items;
create policy "content_library_items_write" on public.content_library_items
  for all to authenticated
  using (organization_id = public.current_user_org_id() and public.current_user_role() = 'super_admin')
  with check (organization_id = public.current_user_org_id() and public.current_user_role() = 'super_admin');

drop trigger if exists set_updated_at on public.content_library_items;
create trigger set_updated_at before update on public.content_library_items
  for each row execute function public.set_updated_at();

-- One row per org: the "Biz haqimizda" and "Darsliklar" tabs each keep
-- their own Google Sheets link permanently in one place, per the request,
-- rather than being just another list item.
create table if not exists public.content_library_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  about_google_sheets_url text,
  training_google_sheets_url text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.content_library_settings enable row level security;

drop policy if exists "content_library_settings_select" on public.content_library_settings;
create policy "content_library_settings_select" on public.content_library_settings
  for select to authenticated
  using (organization_id = public.current_user_org_id() or public.is_platform_owner());

drop policy if exists "content_library_settings_write" on public.content_library_settings;
create policy "content_library_settings_write" on public.content_library_settings
  for all to authenticated
  using (organization_id = public.current_user_org_id() and public.current_user_role() = 'super_admin')
  with check (organization_id = public.current_user_org_id() and public.current_user_role() = 'super_admin');

drop trigger if exists set_updated_at on public.content_library_settings;
create trigger set_updated_at before update on public.content_library_settings
  for each row execute function public.set_updated_at();
