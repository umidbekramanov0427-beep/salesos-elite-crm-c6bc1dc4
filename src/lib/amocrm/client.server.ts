// Server-only. One-way sync: AmoCRM -> SalesOS Elite leads.
// Never import this from a route file or component that ships to the client —
// it touches AMOCRM_CLIENT_SECRET and the Supabase service-role key.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type AmoConnection = {
  id: boolean;
  subdomain: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  connected_by: string | null;
  connected_at: string;
  last_synced_at: string | null;
  last_sync_error: string | null;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(`Missing environment variable: ${name}. Add it in Settings -> Secrets.`);
  return value;
}

export function getAmoClientId(): string {
  return requireEnv("AMOCRM_CLIENT_ID");
}

export function getAmoRedirectUri(): string {
  return requireEnv("AMOCRM_REDIRECT_URI");
}

/**
 * The URL an admin is sent to in order to grant SalesOS access to their
 * AmoCRM account. If this doesn't land correctly, use the "link for setting
 * up the integration" shown on the integration's page in AmoCRM instead —
 * it encodes the same client_id/redirect_uri and is guaranteed correct for
 * your account's region (amocrm.ru vs amocrm.com vs kommo.com).
 */
export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({ client_id: getAmoClientId(), state });
  return `https://www.amocrm.ru/oauth?${params.toString()}`;
}

async function tokenRequest(subdomain: string, body: Record<string, string>) {
  const res = await fetch(`https://${subdomain}/oauth2/access_token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AmoCRM token request failed (${res.status}): ${text}`);
  }
  return (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };
}

/** Exchanges the one-time authorization code AmoCRM sends to the callback for real tokens. */
export async function exchangeCodeForTokens(code: string, subdomain: string) {
  const tokens = await tokenRequest(subdomain, {
    client_id: getAmoClientId(),
    client_secret: requireEnv("AMOCRM_CLIENT_SECRET"),
    grant_type: "authorization_code",
    code,
    redirect_uri: getAmoRedirectUri(),
  });
  return tokens;
}

async function refreshTokens(conn: AmoConnection) {
  const tokens = await tokenRequest(conn.subdomain, {
    client_id: getAmoClientId(),
    client_secret: requireEnv("AMOCRM_CLIENT_SECRET"),
    grant_type: "refresh_token",
    refresh_token: conn.refresh_token,
    redirect_uri: getAmoRedirectUri(),
  });
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const { error } = await supabaseAdmin
    .from("amocrm_connection")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt,
    })
    .eq("id", true);
  if (error) throw error;
  return {
    ...conn,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires_at: expiresAt,
  };
}

export async function getConnection(): Promise<AmoConnection | null> {
  const { data, error } = await supabaseAdmin
    .from("amocrm_connection")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function ensureValidToken(conn: AmoConnection): Promise<AmoConnection> {
  const expiresInMs = new Date(conn.token_expires_at).getTime() - Date.now();
  if (expiresInMs > 60_000) return conn;
  return refreshTokens(conn);
}

async function amoFetch(conn: AmoConnection, path: string) {
  const res = await fetch(`https://${conn.subdomain}${path}`, {
    headers: { authorization: `Bearer ${conn.access_token}` },
  });
  if (res.status === 204) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AmoCRM API error (${res.status}) on ${path}: ${text}`);
  }
  return await res.json();
}

type AmoLead = {
  id: number;
  name: string | null;
  price: number | null;
  created_at: number;
  _embedded?: { tags?: { id: number; name: string }[] };
};

function amoTagNames(lead: AmoLead): string[] {
  return (lead._embedded?.tags ?? []).map((t) => t.name).filter(Boolean);
}

async function fetchAllLeads(conn: AmoConnection): Promise<AmoLead[]> {
  const all: AmoLead[] = [];
  let page = 1;
  for (;;) {
    const data = (await amoFetch(conn, `/api/v4/leads?limit=250&page=${page}&with=tags`)) as {
      _embedded?: { leads?: AmoLead[] };
    } | null;
    const leads = data?._embedded?.leads ?? [];
    if (leads.length === 0) break;
    all.push(...leads);
    page += 1;
    if (page > 200) break; // safety cap: 50k leads
  }
  return all;
}

async function defaultStageId(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("pipeline_stages")
    .select("id")
    .eq("key", "new")
    .maybeSingle();
  return data?.id ?? null;
}

export type SyncResult = { synced: number; error?: string };

/** Pulls every lead from AmoCRM and upserts it into public.leads, keyed by amocrm_id. */
export async function syncLeadsFromAmo(): Promise<SyncResult> {
  const conn0 = await getConnection();
  if (!conn0) throw new Error("AmoCRM is not connected yet.");
  const conn = await ensureValidToken(conn0);

  try {
    const [leads, stageId] = await Promise.all([fetchAllLeads(conn), defaultStageId()]);

    if (leads.length > 0) {
      const rows = leads.map((l) => ({
        amocrm_id: l.id,
        name: l.name?.trim() || `AmoCRM lead #${l.id}`,
        company_name: "",
        source: "AmoCRM",
        expected_revenue: l.price ?? 0,
        budget: l.price ?? 0,
        stage_id: stageId,
        temperature: "Warm" as const,
        priority: "Normal" as const,
        tags: amoTagNames(l),
      }));
      const { error } = await supabaseAdmin.from("leads").upsert(rows, { onConflict: "amocrm_id" });
      if (error) throw error;
    }

    await supabaseAdmin
      .from("amocrm_connection")
      .update({ last_synced_at: new Date().toISOString(), last_sync_error: null })
      .eq("id", true);
    await supabaseAdmin
      .from("integration_settings")
      .update({
        config: {
          subdomain: conn.subdomain,
          last_synced_at: new Date().toISOString(),
          lead_count: leads.length,
        },
      })
      .eq("key", "amocrm");

    return { synced: leads.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown sync error";
    await supabaseAdmin
      .from("amocrm_connection")
      .update({ last_sync_error: message })
      .eq("id", true);
    return { synced: 0, error: message };
  }
}

/** Upserts a single lead — used by the webhook handler for near-real-time updates. */
export async function upsertSingleAmoLead(
  amoLeadId: number,
  name: string | null,
  price: number | null,
) {
  const stageId = await defaultStageId();
  const { error } = await supabaseAdmin.from("leads").upsert(
    {
      amocrm_id: amoLeadId,
      name: name?.trim() || `AmoCRM lead #${amoLeadId}`,
      company_name: "",
      source: "AmoCRM",
      expected_revenue: price ?? 0,
      budget: price ?? 0,
      stage_id: stageId,
      temperature: "Warm" as const,
      priority: "Normal" as const,
    },
    { onConflict: "amocrm_id" },
  );
  if (error) throw error;
}
