-- The manual-call-upload feature ("Yozib olishni yuklash") has been
-- throwing "Bucket not found" -- the call-recordings storage bucket and its
-- access policies were defined in an earlier migration
-- (20260811030000_manual_call_uploads.sql) but never actually applied to
-- this database. Re-issued here in a form that's safe to run even if some
-- pieces from that migration DID land (idempotent: bucket insert already
-- no-ops on conflict, policies now drop-and-recreate instead of erroring
-- "already exists").
insert into storage.buckets (id, name, public)
values ('call-recordings', 'call-recordings', true)
on conflict (id) do nothing;

drop policy if exists "call_recordings_insert_own" on storage.objects;
create policy "call_recordings_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'call-recordings' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "call_recordings_read" on storage.objects;
create policy "call_recordings_read" on storage.objects
  for select to public
  using (bucket_id = 'call-recordings');
