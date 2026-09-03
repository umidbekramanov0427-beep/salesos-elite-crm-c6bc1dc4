"""Environment configuration -- direct port of the process.env reads
scattered across src/integrations/supabase/client.server.ts,
src/lib/auth.server.ts and src/lib/amocrm/client.server.ts (requireEnv)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: str
    supabase_service_role_key: str
    supabase_publishable_key: str

    amocrm_client_id: str | None = None
    amocrm_client_secret: str | None = None
    amocrm_redirect_uri: str | None = None

    gemini_api_key: str | None = None
    openai_api_key: str | None = None

    telegram_bot_token: str | None = None
    telegram_hr_bot_token: str | None = None

    vapid_subject: str | None = None
    vapid_public_key: str | None = None
    vapid_private_key: str | None = None

    cron_secret: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
