"""Service-role Supabase client -- port of
src/integrations/supabase/client.server.ts's `supabaseAdmin` export.

Deliberately uses the SAME Postgres database as the existing TypeScript
backend, through the same PostgREST layer (not a raw DB connection), so RLS
policies, triggers and the schema itself stay exactly as they are -- only
the application code calling them is being ported. Bypasses RLS via the
service-role key, exactly like the TS client.server.ts does; every route
that ports over must re-implement its own authorization checks (see
app/auth.py) instead of relying on RLS, same as the original.
"""

from functools import lru_cache

from supabase import Client, create_client

from app.config import get_settings


@lru_cache
def get_supabase_admin() -> Client:
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
