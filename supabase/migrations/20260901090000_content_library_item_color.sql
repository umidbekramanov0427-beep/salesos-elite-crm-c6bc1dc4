-- Lets a super_admin pick a background color per content-library card,
-- like the rollout-plan phase colors, but restricted to a light/pastel
-- palette only -- these cards carry body text, so a dark fill would hurt
-- readability where the automatic per-type tint doesn't already handle it.
alter table public.content_library_items
  add column if not exists color text;

alter table public.content_library_items
  drop constraint if exists content_library_items_color_check;

alter table public.content_library_items
  add constraint content_library_items_color_check
  check (color is null or color in ('slate', 'blue', 'purple', 'pink', 'orange', 'teal', 'indigo', 'cyan', 'amber'));
