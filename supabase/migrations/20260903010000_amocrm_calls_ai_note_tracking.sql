-- Tracks the AI-authored AmoCRM note separately from amocrm_note_id (which
-- already means something else here -- the id of the *incoming* call note
-- synced FROM AmoCRM, used as this table's own dedupe key). Lets the
-- platform show "AI eslatma yozdi" next to the existing "AI vazifa qo'ydi"
-- indicator, instead of that only ever being visible inside AmoCRM itself.
alter table public.amocrm_calls add column if not exists ai_note_id bigint;
alter table public.amocrm_calls add column if not exists ai_note_created_at timestamptz;
