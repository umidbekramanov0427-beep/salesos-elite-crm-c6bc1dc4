-- The Kadrlar bo'limi bot is a separate, dedicated Telegram bot from the
-- reports/onboarding one -- its username (for building t.me/<user>?start=
-- links) is edited from Kadrlar bo'limi's own settings page, same as the
-- reports bot's username is edited from Sozlamalar -> Integratsiyalar.
alter table public.hr_settings add column if not exists telegram_bot_username text;
