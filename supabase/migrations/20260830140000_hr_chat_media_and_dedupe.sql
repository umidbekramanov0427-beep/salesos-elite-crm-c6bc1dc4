-- Rich Telegram chat: a message can now carry an attachment (image,
-- document, audio) or a location instead of/alongside plain text, so
-- `body` is no longer required.
alter table public.hr_candidate_messages alter column body drop not null;
alter table public.hr_candidate_messages
  add column if not exists attachment_url text,
  add column if not exists attachment_type text
    check (attachment_type in ('image', 'document', 'audio', 'location')),
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision;

-- Storage for both directions: files a super_admin sends out (uploaded
-- straight from the browser, folder-scoped to their own uid) and files a
-- candidate sends in (re-hosted here by telegram.hr-webhook.ts so the CRM
-- never has to expose the bot token to display them). Public bucket, same
-- pattern as the existing call-recordings bucket.
insert into storage.buckets (id, name, public)
values ('hr-chat-attachments', 'hr-chat-attachments', true)
on conflict (id) do nothing;

drop policy if exists "hr_chat_attachments_insert" on storage.objects;
create policy "hr_chat_attachments_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'hr-chat-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "hr_chat_attachments_read" on storage.objects;
create policy "hr_chat_attachments_read" on storage.objects
  for select to public
  using (bucket_id = 'hr-chat-attachments');

-- A Telegram chat should only ever have one application, ever. Collapse
-- any pre-existing duplicates (from testing the bot against more than one
-- vacancy link with the same account) down to the earliest one before the
-- uniqueness constraint below, so it doesn't fail on that leftover data.
-- Re-running this is a no-op once no duplicates remain.
delete from public.hr_candidates a
using public.hr_candidates b
where a.telegram_chat_id = b.telegram_chat_id
  and a.created_at > b.created_at;

create unique index if not exists hr_candidates_telegram_chat_id_key
  on public.hr_candidates (telegram_chat_id);
