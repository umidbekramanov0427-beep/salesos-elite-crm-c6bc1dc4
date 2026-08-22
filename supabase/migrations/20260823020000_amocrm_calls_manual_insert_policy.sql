-- Manual call upload got past the storage bucket fix (the file itself
-- uploads fine now) but then failed inserting the amocrm_calls row with
-- "new row violates row-level security policy" -- the INSERT policy that
-- allows a user to insert their own manual call rows was defined back in
-- 20260811030000_manual_call_uploads.sql but, like the storage bucket in
-- that same file, evidently never actually got applied to this database.
-- Re-issued here, safe to run even if it partially landed.
alter table public.amocrm_calls
  alter column amocrm_note_id drop not null;

alter table public.amocrm_calls
  add column if not exists source text not null default 'amocrm' check (source in ('amocrm', 'manual')),
  add column if not exists created_by uuid references public.profiles(id);

drop policy if exists "amocrm_calls_insert_manual" on public.amocrm_calls;
create policy "amocrm_calls_insert_manual" on public.amocrm_calls
  for insert to authenticated
  with check (source = 'manual' and created_by = auth.uid() and amocrm_note_id is null);
