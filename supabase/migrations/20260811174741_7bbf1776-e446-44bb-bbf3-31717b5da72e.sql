ALTER TABLE public.auto_responders
  ADD COLUMN IF NOT EXISTS trigger_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS message text NOT NULL DEFAULT '';
ALTER TABLE public.auto_responders DROP COLUMN IF EXISTS question;

ALTER TABLE public.amocrm_connection ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.integration_settings ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.business_profile ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.leads ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.deals ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.contacts ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.companies ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.tasks ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.pipeline_stages ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.amocrm_calls ALTER COLUMN organization_id SET NOT NULL;

REVOKE EXECUTE ON FUNCTION public.current_org_id() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_platform_owner() FROM anon, authenticated, public;
