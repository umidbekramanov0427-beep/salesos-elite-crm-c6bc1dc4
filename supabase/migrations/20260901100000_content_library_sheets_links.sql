-- Replaces the single "one Google Sheets URL per tab" field with a real,
-- titled multi-link list -- reuses content_library_items (two new section
-- values) instead of a new table, so the sheets list gets the same
-- open/view/copy/edit/delete affordances already built for every other item.
alter table public.content_library_items
  drop constraint if exists content_library_items_section_check;

alter table public.content_library_items
  add constraint content_library_items_section_check
  check (
    section in (
      'about_general', 'about_org_structure', 'about_regulation', 'training',
      'about_sheets', 'training_sheets'
    )
  );

-- One-time carry-over of each org's existing single sheet link into the new
-- list, guarded by "no row for this org+section yet" instead of a unique
-- constraint so re-running this migration never duplicates it.
insert into public.content_library_items
  (organization_id, section, title, item_type, url, created_by)
select s.organization_id, 'about_sheets', 'Google Sheets', 'link', s.about_google_sheets_url, s.updated_by
from public.content_library_settings s
where s.about_google_sheets_url is not null
  and s.about_google_sheets_url <> ''
  and not exists (
    select 1 from public.content_library_items i
    where i.organization_id = s.organization_id and i.section = 'about_sheets'
  );

insert into public.content_library_items
  (organization_id, section, title, item_type, url, created_by)
select s.organization_id, 'training_sheets', 'Google Sheets', 'link', s.training_google_sheets_url, s.updated_by
from public.content_library_settings s
where s.training_google_sheets_url is not null
  and s.training_google_sheets_url <> ''
  and not exists (
    select 1 from public.content_library_items i
    where i.organization_id = s.organization_id and i.section = 'training_sheets'
  );
