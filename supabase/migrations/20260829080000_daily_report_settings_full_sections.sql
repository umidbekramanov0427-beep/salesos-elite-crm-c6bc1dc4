-- Extends daily_report_settings with the sections discovered from the full
-- "Kunlik hisobot tarkibi" reference screen (missed on the first pass, which
-- only covered Menejerlar faoliyati / Lidlar harakati / Lid sifati / Anketa
-- savollari): CRM faolligi, Vazifalar rejasi, Qo'ng'iroqlar sifati, Xizmat
-- yo'nalishlari, Tavsiyalar, Xulosa -- each a plain on/off toggle, no
-- subset picker. Also adds report_sample_override, the text an admin can
-- save via the "Tahrirlash" pencil to override the live-generated preview.
alter table public.daily_report_settings add column if not exists crm_activity_enabled boolean not null default true;
alter table public.daily_report_settings add column if not exists tasks_plan_enabled boolean not null default true;
alter table public.daily_report_settings add column if not exists call_quality_enabled boolean not null default true;
alter table public.daily_report_settings add column if not exists service_lines_enabled boolean not null default true;
alter table public.daily_report_settings add column if not exists recommendations_enabled boolean not null default true;
alter table public.daily_report_settings add column if not exists summary_enabled boolean not null default true;
alter table public.daily_report_settings add column if not exists report_sample_override text;
