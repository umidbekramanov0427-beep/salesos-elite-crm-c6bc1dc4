-- Adds a "text" item type to the content library: a written note stored
-- directly on the row (in `description`) instead of requiring a link or an
-- uploaded file. Every existing item_type required a url, which made no
-- sense for a plain block of text (e.g. a reglament pasted directly into
-- the add-item dialog) -- the form rejected it with "Havola yoki fayl
-- kerak." even though the whole point was to save the text itself.
alter table public.content_library_items
  alter column url drop not null;

alter table public.content_library_items
  drop constraint if exists content_library_items_item_type_check;

alter table public.content_library_items
  add constraint content_library_items_item_type_check
  check (item_type in ('link', 'file', 'image', 'video', 'audio', 'document', 'text'));
