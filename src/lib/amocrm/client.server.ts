// Server-only. One-way sync: AmoCRM -> SalesOS Elite leads, contacts,
// companies and pipeline stages. Never import this from a route file or
// component that ships to the client — it touches AMOCRM_CLIENT_SECRET and
// the Supabase service-role key.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type AmoConnection = {
  organization_id: string;
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
    .eq("organization_id", conn.organization_id);
  if (error) throw error;
  return {
    ...conn,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires_at: expiresAt,
  };
}

export async function getConnection(organizationId: string): Promise<AmoConnection | null> {
  const { data, error } = await supabaseAdmin
    .from("amocrm_connection")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function ensureValidToken(conn: AmoConnection): Promise<AmoConnection> {
  const expiresInMs = new Date(conn.token_expires_at).getTime() - Date.now();
  if (expiresInMs > 60_000) return conn;
  return refreshTokens(conn);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// AmoCRM enforces a per-integration rate limit (undocumented exact number,
// commonly reported around 7 req/s) — fetching several list endpoints
// concurrently (see fetchAllPaged below) can burst past it and get 429s
// back. Retrying with backoff instead of failing the whole sync handles
// that regardless of the exact limit, rather than trying to guess a
// concurrency level that's always safe.
const RATE_LIMIT_MAX_RETRIES = 6;

async function amoFetch(conn: AmoConnection, path: string, attempt = 1): Promise<unknown> {
  const res = await fetch(`https://${conn.subdomain}${path}`, {
    headers: { authorization: `Bearer ${conn.access_token}` },
  });
  if (res.status === 429 && attempt <= RATE_LIMIT_MAX_RETRIES) {
    const retryAfterHeader = Number(res.headers.get("retry-after"));
    const delayMs = (retryAfterHeader > 0 ? retryAfterHeader : attempt) * 1000;
    await sleep(delayMs);
    return amoFetch(conn, path, attempt + 1);
  }
  if (res.status === 204) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AmoCRM API error (${res.status}) on ${path}: ${text}`);
  }
  return await res.json();
}

// AmoCRM's list endpoints don't return a total count, so pagination has to
// keep requesting pages until one comes back empty. Doing that one page at
// a time was the dominant cost of a sync for any account with more than a
// few hundred records — each page is its own network round-trip to
// AmoCRM. Requesting a small batch of pages concurrently cuts that wall-
// clock time roughly by the batch size. Kept modest (rather than higher)
// because syncLeadsFromAmo also runs several of these paginated fetches
// (leads, contacts, companies, users) at the same time via Promise.all —
// amoFetch's 429 retry above is the real safety net, this just keeps
// bursts smaller to begin with.
const PAGE_FETCH_CONCURRENCY = 3;

async function fetchAllPaged<T>(
  conn: AmoConnection,
  pathForPage: (page: number) => string,
  extractItems: (data: unknown) => T[],
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  let done = false;
  while (!done) {
    const pages = Array.from({ length: PAGE_FETCH_CONCURRENCY }, (_, i) => page + i);
    const results = await Promise.all(
      pages.map((p) => amoFetch(conn, pathForPage(p)).then(extractItems)),
    );
    for (const items of results) {
      all.push(...items);
      if (items.length === 0) done = true;
    }
    page += PAGE_FETCH_CONCURRENCY;
    if (page > 800) break; // safety cap: ~200k records at limit=250
  }
  return all;
}

async function amoWriteFetch(
  conn: AmoConnection,
  path: string,
  method: "POST" | "PATCH",
  body: unknown,
) {
  const res = await fetch(`https://${conn.subdomain}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${conn.access_token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AmoCRM API error (${res.status}) on ${path}: ${text}`);
  }
  return await res.json();
}

/**
 * Creates a task on an AmoCRM lead — used to hand a call's AI-suggested next
 * step to the responsible manager as a reminder inside AmoCRM itself, right
 * after a call recording is analyzed.
 */
export async function createAmoTask(
  organizationId: string,
  leadAmoId: number,
  text: string,
  completeTill: number,
  responsibleAmoUserId: number | null,
): Promise<number | null> {
  const conn = await getConnection(organizationId);
  if (!conn) throw new Error("AmoCRM ulanmagan.");
  const validConn = await ensureValidToken(conn);
  const payload = [
    {
      text,
      complete_till: completeTill,
      entity_id: leadAmoId,
      entity_type: "leads",
      ...(responsibleAmoUserId != null ? { responsible_user_id: responsibleAmoUserId } : {}),
    },
  ];
  const json = (await amoWriteFetch(validConn, "/api/v4/tasks", "POST", payload)) as {
    _embedded?: { tasks?: { id: number }[] };
  };
  return json._embedded?.tasks?.[0]?.id ?? null;
}

type AmoLead = {
  id: number;
  name: string | null;
  price: number | null;
  status_id: number;
  pipeline_id: number;
  responsible_user_id: number | null;
  created_at: number;
  _embedded?: {
    tags?: { id: number; name: string }[];
    contacts?: { id: number; is_main?: boolean }[];
    companies?: { id: number }[];
  };
};

function amoTagNames(lead: AmoLead): string[] {
  return (lead._embedded?.tags ?? []).map((t) => t.name).filter(Boolean);
}

/** First linked contact (preferring the one marked main), if any. */
function amoMainContactId(lead: AmoLead): number | null {
  const contacts = lead._embedded?.contacts ?? [];
  return contacts.find((c) => c.is_main)?.id ?? contacts[0]?.id ?? null;
}

function amoMainCompanyId(lead: AmoLead): number | null {
  return lead._embedded?.companies?.[0]?.id ?? null;
}

async function fetchAllLeads(conn: AmoConnection): Promise<AmoLead[]> {
  return fetchAllPaged(
    conn,
    (page) => `/api/v4/leads?limit=250&page=${page}&with=tags,contacts,companies`,
    (data) => (data as { _embedded?: { leads?: AmoLead[] } } | null)?._embedded?.leads ?? [],
  );
}

type AmoCustomFieldValue = { field_code: string | null; values?: { value?: string }[] };
type AmoContact = {
  id: number;
  name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  custom_fields_values?: AmoCustomFieldValue[] | null;
};
type AmoCompany = { id: number; name: string | null };

function customField(entity: AmoContact, code: string): string | null {
  const field = (entity.custom_fields_values ?? []).find((f) => f.field_code === code);
  return field?.values?.[0]?.value ?? null;
}

async function fetchAllContacts(conn: AmoConnection): Promise<Map<number, AmoContact>> {
  const contacts = await fetchAllPaged(
    conn,
    (page) => `/api/v4/contacts?limit=250&page=${page}`,
    (data) =>
      (data as { _embedded?: { contacts?: AmoContact[] } } | null)?._embedded?.contacts ?? [],
  );
  return new Map(contacts.map((c) => [c.id, c]));
}

async function fetchAllCompanies(conn: AmoConnection): Promise<Map<number, AmoCompany>> {
  const companies = await fetchAllPaged(
    conn,
    (page) => `/api/v4/companies?limit=250&page=${page}`,
    (data) =>
      (data as { _embedded?: { companies?: AmoCompany[] } } | null)?._embedded?.companies ?? [],
  );
  return new Map(companies.map((c) => [c.id, c]));
}

type AmoUser = { id: number; email: string | null; name?: string | null };

async function fetchAllUsers(conn: AmoConnection): Promise<AmoUser[]> {
  return fetchAllPaged(
    conn,
    (page) => `/api/v4/users?limit=250&page=${page}`,
    (data) => (data as { _embedded?: { users?: AmoUser[] } } | null)?._embedded?.users ?? [],
  );
}

type AmoStatus = { id: number; name: string; sort: number; pipeline_id: number };
type AmoPipeline = { id: number; name: string; _embedded?: { statuses?: AmoStatus[] } };

async function fetchPipelines(conn: AmoConnection): Promise<AmoPipeline[]> {
  const data = (await amoFetch(conn, "/api/v4/leads/pipelines?with=statuses")) as {
    _embedded?: { pipelines?: AmoPipeline[] };
  } | null;
  return data?._embedded?.pipelines ?? [];
}

// AmoCRM reserves these two status ids for "won"/"lost" in every pipeline —
// a fixed, documented convention, not something specific to any account.
const AMO_WON_STATUS_ID = 142;
const AMO_LOST_STATUS_ID = 143;
const STAGE_COLOR_ROTATION = ["bg-primary", "bg-info", "bg-warning", "bg-mint-border"] as const;

/**
 * Mirrors AmoCRM's real pipeline/status structure into pipeline_stages, one
 * row per (organization, amocrm_status_id) — additive, so stages created by
 * hand in Settings (which have no amocrm_status_id) are left untouched.
 * Returns a status_id -> our stage_id lookup for lead upserts.
 */
async function syncPipelineStages(
  organizationId: string,
  conn: AmoConnection,
): Promise<Map<number, string>> {
  const pipelines = await fetchPipelines(conn);
  const rows: {
    organization_id: string;
    amocrm_pipeline_id: number;
    amocrm_status_id: number;
    key: string;
    name: string;
    position: number;
    color: string;
    probability: number;
    is_won: boolean;
    is_lost: boolean;
  }[] = [];

  let index = 0;
  for (const pipeline of pipelines) {
    for (const status of pipeline._embedded?.statuses ?? []) {
      const isWon = status.id === AMO_WON_STATUS_ID;
      const isLost = status.id === AMO_LOST_STATUS_ID;
      rows.push({
        organization_id: organizationId,
        amocrm_pipeline_id: pipeline.id,
        amocrm_status_id: status.id,
        key: `amo-${status.id}`,
        name: status.name,
        position: status.sort ?? index,
        color: isWon
          ? "bg-success"
          : isLost
            ? "bg-destructive"
            : STAGE_COLOR_ROTATION[index % STAGE_COLOR_ROTATION.length]!,
        probability: isWon ? 100 : isLost ? 0 : Math.min(90, 20 + index * 15),
        is_won: isWon,
        is_lost: isLost,
      });
      index += 1;
    }
  }
  if (rows.length === 0) return new Map();

  const { data, error } = await supabaseAdmin
    .from("pipeline_stages")
    .upsert(rows, { onConflict: "organization_id,amocrm_status_id" })
    .select("id, amocrm_status_id");
  if (error) throw error;

  const map = new Map<number, string>();
  for (const row of data ?? []) {
    if (row.amocrm_status_id != null) map.set(row.amocrm_status_id, row.id);
  }
  return map;
}

/** Matches AmoCRM users to existing profiles by email, returns amoUserId -> our profile id. */
// Shared login password for every auto-provisioned sales rep account. Reps
// log in with their AmoCRM email as username; nobody picks this password
// individually, so it's a fixed, known value by design (per product spec).
const SOTUV_MENEJERI_DEFAULT_PASSWORD = "12345678";

async function syncUserMapping(
  organizationId: string,
  conn: AmoConnection,
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  try {
    const [users, { data: profiles, error }] = await Promise.all([
      fetchAllUsers(conn),
      supabaseAdmin
        .from("profiles")
        .select("id, email, amocrm_user_id")
        .eq("organization_id", organizationId),
    ]);
    if (error) throw error;
    const profileByEmail = new Map((profiles ?? []).map((p) => [p.email.toLowerCase(), p]));
    for (const amoUser of users) {
      if (!amoUser.email) continue;
      const email = amoUser.email.toLowerCase();
      let profile = profileByEmail.get(email);
      if (!profile) {
        // No CRM account for this AmoCRM user yet — auto-provision a sales
        // rep account so they can log in with their AmoCRM email and the
        // shared rep password, instead of silently staying unmapped.
        const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: amoUser.email,
          password: SOTUV_MENEJERI_DEFAULT_PASSWORD,
          email_confirm: true,
          user_metadata: {
            full_name: amoUser.name?.trim() || amoUser.email,
            role: "sotuv_menejeri",
            organization_id: organizationId,
          },
        });
        if (createError || !created.user) {
          // Most likely an email collision with an existing auth user in a
          // different organization — report it distinctly and keep going,
          // don't let one failed provisioning attempt abort the whole sync.
          console.error(
            `[amocrm sync] Could not auto-provision rep account for ${amoUser.email}: ${createError?.message ?? "unknown error"}`,
          );
          continue;
        }
        profile = { id: created.user.id, email: amoUser.email, amocrm_user_id: null };
        profileByEmail.set(email, profile);
      }
      map.set(amoUser.id, profile.id);
      // Skip the write when the mapping is already correct — on every
      // sync after the first, this avoids a DB round-trip per AmoCRM user.
      if (profile.amocrm_user_id !== amoUser.id) {
        await supabaseAdmin
          .from("profiles")
          .update({ amocrm_user_id: amoUser.id })
          .eq("id", profile.id);
      }
    }
  } catch {
    // Owner matching is best-effort — a failure here shouldn't block the
    // lead/company/contact sync, which is the primary purpose of a sync run.
  }
  return map;
}

async function defaultStageId(organizationId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("pipeline_stages")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("key", "new")
    .maybeSingle();
  return data?.id ?? null;
}

type AmoCallNote = {
  id: number;
  entity_id: number;
  note_type: "call_in" | "call_out";
  created_at: number;
  params?: {
    duration?: number;
    phone?: string;
    link?: string;
  };
};

/** Pulls every call-type note (from a connected telephony integration) across all leads. */
async function fetchCallNotes(conn: AmoConnection): Promise<AmoCallNote[]> {
  return fetchAllPaged(
    conn,
    (page) =>
      `/api/v4/leads/notes?filter[note_type][]=call_in&filter[note_type][]=call_out&limit=250&page=${page}`,
    (data) => (data as { _embedded?: { notes?: AmoCallNote[] } } | null)?._embedded?.notes ?? [],
  );
}

export type SyncResult = { synced: number; callsSynced?: number; error?: string };

/** Pulls every lead from AmoCRM and upserts it into public.leads, keyed by (organization_id, amocrm_id). */
export async function syncLeadsFromAmo(organizationId: string): Promise<SyncResult> {
  const conn0 = await getConnection(organizationId);
  if (!conn0) throw new Error("AmoCRM is not connected yet.");
  const conn = await ensureValidToken(conn0);

  try {
    const [leads, contactsById, companiesById, stageByStatusId, ownerByAmoUserId, fallbackStageId] =
      await Promise.all([
        fetchAllLeads(conn),
        fetchAllContacts(conn),
        fetchAllCompanies(conn),
        syncPipelineStages(organizationId, conn),
        syncUserMapping(organizationId, conn),
        defaultStageId(organizationId),
      ]);

    // Upsert every referenced contact/company first so leads can link to
    // their real internal ids instead of just carrying a name string.
    const referencedContactIds = new Set<number>();
    const referencedCompanyIds = new Set<number>();
    for (const l of leads) {
      const cId = amoMainContactId(l);
      const coId = amoMainCompanyId(l);
      if (cId) referencedContactIds.add(cId);
      if (coId) referencedCompanyIds.add(coId);
    }

    const contactIdMap = new Map<number, string>();
    if (referencedContactIds.size > 0) {
      const contactRows = Array.from(referencedContactIds)
        .map((id) => contactsById.get(id))
        .filter((c): c is AmoContact => !!c)
        .map((c) => ({
          organization_id: organizationId,
          amocrm_id: c.id,
          full_name: c.name?.trim() || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—",
          phone: customField(c, "PHONE"),
          email: customField(c, "EMAIL"),
        }));
      if (contactRows.length > 0) {
        const { data, error } = await supabaseAdmin
          .from("contacts")
          .upsert(contactRows, { onConflict: "organization_id,amocrm_id" })
          .select("id, amocrm_id");
        if (error) throw error;
        for (const row of data ?? []) {
          if (row.amocrm_id != null) contactIdMap.set(row.amocrm_id, row.id);
        }
      }
    }

    const companyIdMap = new Map<number, string>();
    if (referencedCompanyIds.size > 0) {
      const companyRows = Array.from(referencedCompanyIds)
        .map((id) => companiesById.get(id))
        .filter((c): c is AmoCompany => !!c)
        .map((c) => ({
          organization_id: organizationId,
          amocrm_id: c.id,
          name: c.name?.trim() || `AmoCRM company #${c.id}`,
        }));
      if (companyRows.length > 0) {
        const { data, error } = await supabaseAdmin
          .from("companies")
          .upsert(companyRows, { onConflict: "organization_id,amocrm_id" })
          .select("id, amocrm_id");
        if (error) throw error;
        for (const row of data ?? []) {
          if (row.amocrm_id != null) companyIdMap.set(row.amocrm_id, row.id);
        }
      }
    }

    if (leads.length > 0) {
      const rows = leads.map((l) => {
        const contactAmoId = amoMainContactId(l);
        const companyAmoId = amoMainCompanyId(l);
        const company = companyAmoId ? companiesById.get(companyAmoId) : undefined;
        return {
          organization_id: organizationId,
          amocrm_id: l.id,
          name: l.name?.trim() || `AmoCRM lead #${l.id}`,
          company_name: company?.name?.trim() || "",
          company_id: companyAmoId ? (companyIdMap.get(companyAmoId) ?? null) : null,
          contact_id: contactAmoId ? (contactIdMap.get(contactAmoId) ?? null) : null,
          source: "AmoCRM",
          expected_revenue: l.price ?? 0,
          budget: l.price ?? 0,
          stage_id: stageByStatusId.get(l.status_id) ?? fallbackStageId,
          owner_id: l.responsible_user_id
            ? (ownerByAmoUserId.get(l.responsible_user_id) ?? null)
            : null,
          temperature: "Warm" as const,
          priority: "Normal" as const,
          tags: amoTagNames(l),
        };
      });
      const { error } = await supabaseAdmin
        .from("leads")
        .upsert(rows, { onConflict: "organization_id,amocrm_id" });
      if (error) throw error;
    }

    let callsSynced = 0;
    try {
      callsSynced = await syncCallsFromAmo(conn);
    } catch {
      // Call sync is best-effort: some AmoCRM accounts have no telephony
      // integration writing call notes, or the notes endpoint isn't
      // reachable for this account. Leads still synced successfully.
    }

    await supabaseAdmin
      .from("amocrm_connection")
      .update({ last_synced_at: new Date().toISOString(), last_sync_error: null })
      .eq("organization_id", organizationId);
    await supabaseAdmin
      .from("integration_settings")
      .update({
        config: {
          subdomain: conn.subdomain,
          last_synced_at: new Date().toISOString(),
          lead_count: leads.length,
        },
      })
      .eq("organization_id", organizationId)
      .eq("key", "amocrm");

    return { synced: leads.length, callsSynced };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown sync error";
    await supabaseAdmin
      .from("amocrm_connection")
      .update({ last_sync_error: message })
      .eq("organization_id", organizationId);
    return { synced: 0, error: message };
  }
}

/** Pulls call-type notes from AmoCRM and upserts them into public.amocrm_calls. Returns count synced. */
async function syncCallsFromAmo(conn: AmoConnection): Promise<number> {
  const notes = await fetchCallNotes(conn);
  if (notes.length === 0) return 0;

  const amoLeadIds = Array.from(new Set(notes.map((n) => n.entity_id)));
  const { data: leadRows, error: leadsError } = await supabaseAdmin
    .from("leads")
    .select("id, amocrm_id")
    .eq("organization_id", conn.organization_id)
    .in("amocrm_id", amoLeadIds);
  if (leadsError) throw leadsError;
  const leadIdByAmoId = new Map((leadRows ?? []).map((l) => [l.amocrm_id, l.id]));

  const rows = notes.map((n) => {
    const duration = n.params?.duration ?? 0;
    return {
      organization_id: conn.organization_id,
      amocrm_note_id: n.id,
      lead_id: leadIdByAmoId.get(n.entity_id) ?? null,
      direction: n.note_type === "call_in" ? "in" : "out",
      phone: n.params?.phone ?? null,
      duration_seconds: duration,
      connected: duration > 0,
      recording_url: n.params?.link ?? null,
      occurred_at: new Date(n.created_at * 1000).toISOString(),
    };
  });

  const { error } = await supabaseAdmin
    .from("amocrm_calls")
    .upsert(rows, { onConflict: "organization_id,amocrm_note_id" });
  if (error) throw error;
  return rows.length;
}

/** Resolves a stage_id for a single AmoCRM status_id, falling back to the org's "new" stage. */
export async function resolveStageId(
  organizationId: string,
  statusId: number | null,
): Promise<string | null> {
  if (statusId != null) {
    const { data } = await supabaseAdmin
      .from("pipeline_stages")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("amocrm_status_id", statusId)
      .maybeSingle();
    if (data?.id) return data.id;
  }
  return defaultStageId(organizationId);
}

/** Resolves an owner profile id for a single AmoCRM responsible_user_id, if that user was matched by email. */
export async function resolveOwnerId(
  organizationId: string,
  amoUserId: number | null,
): Promise<string | null> {
  if (amoUserId == null) return null;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("amocrm_user_id", amoUserId)
    .maybeSingle();
  return data?.id ?? null;
}

/** Upserts a single lead — used by the webhook handler for near-real-time updates. */
export async function upsertSingleAmoLead(
  organizationId: string,
  amoLeadId: number,
  name: string | null,
  price: number | null,
  statusId: number | null,
  responsibleUserId: number | null,
) {
  const [stageId, ownerId] = await Promise.all([
    resolveStageId(organizationId, statusId),
    resolveOwnerId(organizationId, responsibleUserId),
  ]);
  const { error } = await supabaseAdmin.from("leads").upsert(
    {
      organization_id: organizationId,
      amocrm_id: amoLeadId,
      name: name?.trim() || `AmoCRM lead #${amoLeadId}`,
      company_name: "",
      source: "AmoCRM",
      expected_revenue: price ?? 0,
      budget: price ?? 0,
      stage_id: stageId,
      owner_id: ownerId,
      temperature: "Warm" as const,
      priority: "Normal" as const,
    },
    { onConflict: "organization_id,amocrm_id" },
  );
  if (error) throw error;
}
