-- State for the Telegram bot's business-profile onboarding conversation.
-- Triggered right after a super_admin/rop links their Telegram account for
-- the first time (see telegram.webhook.ts) if their org's business profile
-- is still empty — the bot asks the same 5 questions the in-app "AI bot
-- bilan to'ldirish" widget asks, one per message, and fills
-- business_profile directly from the literal answers (no AI parsing
-- needed since each message maps to exactly one field).
alter table public.profiles
  add column if not exists telegram_onboarding_step integer,
  add column if not exists telegram_onboarding_answers jsonb;
