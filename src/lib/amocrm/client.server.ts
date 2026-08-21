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
  // null means "sync everything" (unrestricted, the original behavior) —
  // set once an admin picks a subset on the AmoCRM import-settings page.
  enabled_pipeline_ids: number[] | null;
  enabled_user_ids: number[] | null;
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

// Mutates `conn` in place (in addition to returning it) so that every other
// reference to the same connection object already in flight elsewhere in a
// sync — syncPipelineStages, syncUserMapping, parallel amoFetch calls — picks
// up the refreshed access_token too, without needing every call site to be
// re-threaded through a new object each time a refresh happens.
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
  conn.access_token = tokens.access_token;
  conn.refresh_token = tokens.refresh_token;
  conn.token_expires_at = expiresAt;
  return conn;
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

// Supabase client errors (PostgrestError) carry a `.message` string but are
// plain objects, not `instanceof Error` — a bare `err instanceof Error`
// check silently drops the real reason (missing column, RLS denial, broken
// upsert conflict target, ...) and reports "Unknown sync error" instead.
function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return "Unknown sync error";
}

// A single upsert() call that contains two rows with the same onConflict-key
// value makes Postgres reject the whole statement with "ON CONFLICT DO
// UPDATE command cannot affect row a second time" — and since every sync
// write happens in one batch, that aborts the entire sync, not just the
// offending row. leads/contacts/companies are each already deduped
// upstream by construction, but pipeline_stages never was (nothing stops
// AmoCRM's own API from listing the same status twice inside one
// pipeline), and staying defensive here for all of them is cheap insurance
// against the whole sync ever going dark on this error again. Keeps the
// last occurrence, same as every other last-write-wins dedup in this file.
function dedupeByKey<T>(rows: T[], keyFn: (row: T) => string): T[] {
  return Array.from(new Map(rows.map((r) => [keyFn(r), r])).values());
}

// AmoCRM enforces a per-integration rate limit (undocumented exact number,
// commonly reported around 7 req/s) — fetching several list endpoints
// concurrently (see fetchAllPaged below) can burst past it and get 429s
// back. Retrying with backoff instead of failing the whole sync handles
// that regardless of the exact limit, rather than trying to guess a
// concurrency level that's always safe.
const RATE_LIMIT_MAX_RETRIES = 6;

// 5xx (including Cloudflare's 522 "connection timed out", seen in practice
// in front of AmoCRM) are transient upstream blips, not something wrong on
// our end — without a retry here, one flaky response anywhere in a sync
// aborted the whole run and threw away everything already fetched in that
// request. A shorter retry budget than the 429 case since these aren't
// "back off, you're going too fast" signals — just try again shortly.
const SERVER_ERROR_MAX_RETRIES = 3;

async function amoFetch(
  conn: AmoConnection,
  path: string,
  attempt = 1,
  triedRefresh = false,
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`https://${conn.subdomain}${path}`, {
      headers: { authorization: `Bearer ${conn.access_token}` },
    });
  } catch (err) {
    // fetch() itself throwing (not just returning a bad status) means the
    // connection to AmoCRM failed at the network level — DNS, TLS, refused,
    // etc. Neither the 429 nor the 5xx handling below ever runs in that
    // case since there's no Response to inspect, so this needs its own
    // retry or a single network blip fails the entire sync outright with
    // an opaque "fetch failed" and no chance to recover.
    if (attempt <= SERVER_ERROR_MAX_RETRIES) {
      await sleep(attempt * 1000);
      return amoFetch(conn, path, attempt + 1, triedRefresh);
    }
    throw err;
  }
  if (res.status === 429 && attempt <= RATE_LIMIT_MAX_RETRIES) {
    const retryAfterHeader = Number(res.headers.get("retry-after"));
    const delayMs = (retryAfterHeader > 0 ? retryAfterHeader : attempt) * 1000;
    await sleep(delayMs);
    return amoFetch(conn, path, attempt + 1, triedRefresh);
  }
  if (res.status >= 500 && attempt <= SERVER_ERROR_MAX_RETRIES) {
    await sleep(attempt * 1000);
    return amoFetch(conn, path, attempt + 1, triedRefresh);
  }
  // A 401 here means AmoCRM considers our access_token invalid even though
  // our own stored token_expires_at said it still had time left — the token
  // can be invalidated early (revoked, superseded by another sign-in) with
  // no warning. Force one refresh-and-retry before giving up, so a sync
  // doesn't stay permanently broken on stale expiry bookkeeping alone; if
  // the refresh_token itself is also dead, refreshTokens() throws its own
  // clear error instead of masking it as this 401.
  if (res.status === 401 && !triedRefresh) {
    await refreshTokens(conn);
    return amoFetch(conn, path, attempt, true);
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
  maxPages = 800, // default safety cap: ~200k records at limit=250
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
    if (page > maxPages) break;
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
  loss_reason_id?: number | null;
  _embedded?: {
    tags?: { id: number; name: string }[];
    contacts?: { id: number; is_main?: boolean }[];
    companies?: { id: number }[];
  };
};

/** AmoCRM's account-wide loss-reasons catalog (Sozlamalar → Yo'qotish sabablari) -- fetched once per sync and looked up by id when building lead rows. */
async function fetchLossReasons(conn: AmoConnection): Promise<Map<number, string>> {
  const data = (await amoFetch(conn, "/api/v4/leads/loss_reasons?limit=250")) as {
    _embedded?: { loss_reasons?: { id: number; name: string }[] };
  } | null;
  return new Map((data?._embedded?.loss_reasons ?? []).map((r) => [r.id, r.name]));
}

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

// Leads are fetched and upserted one page at a time by syncLeadsFromAmo
// below (not via fetchAllPaged) so peak memory stays bounded to a single
// page regardless of account size — see the comment on that loop.

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

// Fetching every contact/company in the account (fetchAllContacts/
// fetchAllCompanies used to page through the whole address book,
// unbounded) was the same class of bug as the call-notes hang fixed
// above — an account with tens of thousands of contacts made this the
// dominant cost of a sync, even though only the handful referenced by
// this run's leads is ever used. Fetch exactly those ids instead.
const ENTITY_ID_CHUNK = 100;

async function fetchEntitiesByIds<T extends { id: number }>(
  conn: AmoConnection,
  entity: "contacts" | "companies",
  ids: number[],
): Promise<Map<number, T>> {
  const map = new Map<number, T>();
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += ENTITY_ID_CHUNK) {
    chunks.push(ids.slice(i, i + ENTITY_ID_CHUNK));
  }
  // Chunks used to be fetched one at a time — fine when this only ever ran
  // for a handful of chunks, but an org with thousands of leads (each
  // referencing its own contact/company) can need dozens of chunks, and
  // doing them serially was slow enough on its own to push the whole sync
  // past the platform's request execution limit — the same "killed with no
  // response" failure mode as the original unbounded-fetch bug, just from a
  // new source now that fetch is bounded. Batch them the same way
  // fetchAllPaged already does for pagination.
  for (let i = 0; i < chunks.length; i += PAGE_FETCH_CONCURRENCY) {
    const batch = chunks.slice(i, i + PAGE_FETCH_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (chunk) => {
        const idParams = chunk.map((id) => `filter[id][]=${id}`).join("&");
        const data = (await amoFetch(conn, `/api/v4/${entity}?limit=250&${idParams}`)) as {
          _embedded?: Record<string, T[]>;
        } | null;
        return data?._embedded?.[entity] ?? [];
      }),
    );
    for (const items of results) {
      for (const item of items) map.set(item.id, item);
    }
  }
  return map;
}

type AmoUser = { id: number; email: string | null; name?: string | null };

async function fetchAllUsers(conn: AmoConnection): Promise<AmoUser[]> {
  return fetchAllPaged(
    conn,
    (page) => `/api/v4/users?limit=250&page=${page}`,
    (data) => (data as { _embedded?: { users?: AmoUser[] } } | null)?._embedded?.users ?? [],
  );
}

type AmoStatus = {
  id: number;
  name: string;
  sort: number;
  pipeline_id: number;
  color?: string | null;
};
type AmoPipeline = {
  id: number;
  name: string;
  is_main?: boolean;
  _embedded?: { statuses?: AmoStatus[] };
};

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

/** Builds the lookup key used to disambiguate a status id across pipelines — see syncPipelineStages. */
function pipelineStatusKey(pipelineId: number, statusId: number): string {
  return `${pipelineId}:${statusId}`;
}

type PipelineStageSync = {
  stageByStatusId: Map<string, string>;
  // AmoCRM's own pipeline name (e.g. "Продажи", "Retail") — leads.funnel
  // used to be left at its column default ('Direct Sales') for every
  // AmoCRM-synced lead because nothing set it, which collapsed every real
  // pipeline into one funnel in the UI. Keyed by amocrm_pipeline_id so
  // syncLeadsFromAmo can stamp each lead with its real funnel name.
  pipelineNameById: Map<number, string>;
};

/**
 * Mirrors AmoCRM's real pipeline/status structure into pipeline_stages, one
 * row per (organization, amocrm_pipeline_id, amocrm_status_id) — additive,
 * so stages created by hand in Settings (which have no amocrm_status_id)
 * are left untouched. Returns a "pipelineId:statusId" -> our stage_id
 * lookup for lead upserts — status ids alone aren't unique across
 * pipelines (won/lost are id 142/143 in every pipeline), so a lookup keyed
 * on status id alone would collapse every pipeline's "Won" stage into
 * whichever one was upserted last — plus each pipeline's own name.
 */
async function syncPipelineStages(
  organizationId: string,
  conn: AmoConnection,
): Promise<PipelineStageSync> {
  const allPipelines = await fetchPipelines(conn);
  // An admin can narrow which AmoCRM pipelines actually get synced (see the
  // amocrm-import-settings page) — null means unrestricted, the original
  // behavior.
  const pipelines = conn.enabled_pipeline_ids
    ? allPipelines.filter((p) => conn.enabled_pipeline_ids!.includes(p.id))
    : allPipelines;
  const pipelineNameById = new Map<number, string>(
    pipelines.map((p) => [p.id, p.name?.trim() || "Direct Sales"]),
  );
  const rows: {
    organization_id: string;
    amocrm_pipeline_id: number;
    amocrm_status_id: number;
    key: string;
    name: string;
    pipeline_name: string;
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
        // AmoCRM reuses status ids 142 (won) and 143 (lost) in *every*
        // pipeline — they aren't globally unique. The key must be scoped
        // per pipeline too, or two pipelines' won/lost stages collide on
        // this org's (organization_id, key) uniqueness.
        key: `amo-${pipeline.id}-${status.id}`,
        name: status.name,
        pipeline_name: pipelineNameById.get(pipeline.id) ?? "Direct Sales",
        position: status.sort ?? index,
        // Mirror AmoCRM's own status color exactly (hex, e.g. "#fffeb2") so
        // stage badges match what the org sees inside AmoCRM itself. Some
        // custom statuses come back with no color set -- fall back to the
        // old round-robin Tailwind palette for those (and for won/lost,
        // whose AmoCRM color already reads as green/red in practice).
        color:
          status.color ||
          (isWon
            ? "bg-success"
            : isLost
              ? "bg-destructive"
              : STAGE_COLOR_ROTATION[index % STAGE_COLOR_ROTATION.length]!),
        probability: isWon ? 100 : isLost ? 0 : Math.min(90, 20 + index * 15),
        is_won: isWon,
        is_lost: isLost,
      });
      index += 1;
    }
  }
  if (rows.length === 0) return { stageByStatusId: new Map(), pipelineNameById };

  // This used to be one upsert() call for every pipeline/status combination
  // at once -- fine for a handful of pipelines, but an account with dozens
  // of pipelines (each with its own audit-trail write) pushed a single
  // statement past the database's statement_timeout, failing the sync
  // before it ever got to a single lead. Chunk it the same way every other
  // bulk write in this file already is.
  const STAGE_UPSERT_CHUNK = 200;
  const dedupedRows = dedupeByKey(rows, (r) => `${r.amocrm_pipeline_id}:${r.amocrm_status_id}`);
  const stageByStatusId = new Map<string, string>();
  for (let i = 0; i < dedupedRows.length; i += STAGE_UPSERT_CHUNK) {
    const chunk = dedupedRows.slice(i, i + STAGE_UPSERT_CHUNK);
    const { data, error } = await supabaseAdmin
      .from("pipeline_stages")
      .upsert(chunk, { onConflict: "organization_id,amocrm_pipeline_id,amocrm_status_id" })
      .select("id, amocrm_pipeline_id, amocrm_status_id");
    if (error) throw error;
    for (const row of data ?? []) {
      if (row.amocrm_pipeline_id != null && row.amocrm_status_id != null) {
        stageByStatusId.set(
          pipelineStatusKey(row.amocrm_pipeline_id, row.amocrm_status_id),
          row.id,
        );
      }
    }
  }
  return { stageByStatusId, pipelineNameById };
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

    // This used to await createUser + a profile update one AmoCRM user at a
    // time — fine for a handful of reps, but an account with dozens of
    // users turned this into a long serial chain of network round-trips,
    // the same "slow enough by itself to blow the platform's execution
    // limit" failure as the contacts/companies fetch above. Batch it the
    // same way.
    // An admin can narrow which AmoCRM operators actually get an account
    // and get treated as a lead owner (see the amocrm-import-settings
    // page) — null means unrestricted, the original behavior.
    const usableUsers = users
      .filter((u): u is AmoUser & { email: string } => !!u.email)
      .filter((u) => !conn.enabled_user_ids || conn.enabled_user_ids.includes(u.id));
    for (let i = 0; i < usableUsers.length; i += PAGE_FETCH_CONCURRENCY) {
      const batch = usableUsers.slice(i, i + PAGE_FETCH_CONCURRENCY);
      await Promise.all(
        batch.map(async (amoUser) => {
          const email = amoUser.email.toLowerCase();
          let profile = profileByEmail.get(email);
          if (!profile) {
            // No CRM account for this AmoCRM user yet — auto-provision a
            // sales rep account so they can log in with their AmoCRM email
            // and the shared rep password, instead of silently staying
            // unmapped.
            const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser(
              {
                email: amoUser.email,
                password: SOTUV_MENEJERI_DEFAULT_PASSWORD,
                email_confirm: true,
                user_metadata: {
                  full_name: amoUser.name?.trim() || amoUser.email,
                  role: "sotuv_menejeri",
                  organization_id: organizationId,
                },
              },
            );
            if (createError || !created.user) {
              // Most likely an email collision with an existing auth user
              // in a different organization — report it distinctly and
              // keep going, don't let one failed provisioning attempt
              // abort the whole sync.
              console.error(
                `[amocrm sync] Could not auto-provision rep account for ${amoUser.email}: ${createError?.message ?? "unknown error"}`,
              );
              return;
            }
            profile = { id: created.user.id, email: amoUser.email, amocrm_user_id: null };
            profileByEmail.set(email, profile);
          }
          map.set(amoUser.id, profile.id);
          // Skip the write when the mapping is already correct — on every
          // sync after the first, this avoids a DB round-trip per AmoCRM
          // user.
          if (profile.amocrm_user_id !== amoUser.id) {
            await supabaseAdmin
              .from("profiles")
              .update({ amocrm_user_id: amoUser.id })
              .eq("id", profile.id);
          }
        }),
      );
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

// A full-history call-notes pull is the single biggest unbounded cost in a
// sync — an account with years of call history can have far more notes
// than leads. Unlike the leads loop above, this still builds one array for
// the whole window before upserting, and Lovable's own Worker logs showed
// a sync on this account got killed with "Worker exceeded memory limit" —
// a platform-level kill that bypasses the try/catch around this call in
// syncLeadsFromAmo entirely, so keeping this small is the only real
// defense. Recent call history is what Audio Analytics actually needs;
// cap the window and the page count so this can never be the thing that
// pushes a sync over the memory limit.
const CALL_NOTES_LOOKBACK_DAYS = 30;
const CALL_NOTES_MAX_PAGES = 20; // ~5k notes at limit=250

async function fetchCallNotes(conn: AmoConnection): Promise<AmoCallNote[]> {
  const sinceUnix = Math.floor(Date.now() / 1000) - CALL_NOTES_LOOKBACK_DAYS * 86400;
  const notes = await fetchAllPaged(
    conn,
    (page) =>
      `/api/v4/leads/notes?filter[note_type][]=call_in&filter[note_type][]=call_out&filter[created_at][from]=${sinceUnix}&limit=250&page=${page}`,
    (data) => (data as { _embedded?: { notes?: AmoCallNote[] } } | null)?._embedded?.notes ?? [],
    CALL_NOTES_MAX_PAGES,
  );
  // AmoCRM's page-based pagination isn't a stable snapshot — a note can
  // shift across the page boundary between two concurrent page requests
  // (see PAGE_FETCH_CONCURRENCY) and come back on both pages, which would
  // otherwise hit the upsert below twice in the same batch (see
  // dedupeByKey for why that's also defended independently there).
  return Array.from(new Map(notes.map((n) => [n.id, n])).values());
}

export type SyncResult = { synced: number; callsSynced?: number; error?: string };

/** Pulls every lead from AmoCRM and upserts it into public.leads, keyed by (organization_id, amocrm_id). */
export async function syncLeadsFromAmo(organizationId: string): Promise<SyncResult> {
  const conn0 = await getConnection(organizationId);
  if (!conn0) throw new Error("AmoCRM is not connected yet.");
  const conn = await ensureValidToken(conn0);

  try {
    // Each phase is labeled on failure -- a bare "canceling statement due to
    // statement timeout" (or any other DB/network error) previously landed
    // in last_sync_error with no way to tell which of these three calls,
    // let alone which one of dozens of leads pages, actually caused it.
    const [
      { stageByStatusId, pipelineNameById },
      ownerByAmoUserId,
      fallbackStageId,
      lossReasonById,
    ] = await Promise.all([
      syncPipelineStages(organizationId, conn).catch((e) => {
        throw new Error(`[pipeline stages] ${describeError(e)}`);
      }),
      syncUserMapping(organizationId, conn),
      defaultStageId(organizationId).catch((e) => {
        throw new Error(`[default stage] ${describeError(e)}`);
      }),
      fetchLossReasons(conn).catch(() => new Map<number, string>()),
    ]);

    // Leads used to be fetched into one array for the whole account (up to
    // thousands of objects, each carrying embedded tags/contacts/companies
    // JSON via `with=...`) before any of it was written. Lovable's own
    // Worker logs showed that alone was enough to exceed the platform's
    // memory limit and kill the request with a 502 ("Worker exceeded
    // memory limit") — a different failure than the execution-time limit
    // the earlier concurrency fixes addressed. Stream one page at a time
    // instead: fetch, resolve just that page's own referenced
    // contacts/companies, upsert, then let it be garbage collected before
    // fetching the next page — peak memory stays bounded to a single page
    // no matter how many leads the account has.
    // Every earlier version of this loop walked the *entire* account on
    // every single sync, forever. That's fine once, but for an account with
    // several thousand leads it means dozens of AmoCRM pages (each with its
    // own follow-up contacts/companies calls) — comfortably long enough to
    // blow past both pg_net's cron timeout and the hosting platform's own
    // request-time limit, so the scheduled 5-minute sync never actually
    // finished (confirmed via net._http_response: every cron-triggered call
    // timed out, last_synced_at never advanced). After the first full sync,
    // only ask AmoCRM for leads updated since the last successful sync, with
    // a 10-minute overlap so a slightly-late or skipped run can't drop a
    // lead that changed in the gap.
    const SYNC_OVERLAP_SECONDS = 600;
    const sinceFilter = conn.last_synced_at
      ? `&filter[updated_at][from]=${Math.floor(new Date(conn.last_synced_at).getTime() / 1000) - SYNC_OVERLAP_SECONDS}`
      : "";

    let totalSynced = 0;
    let page = 1;
    for (;;) {
      const pageData = (await amoFetch(
        conn,
        `/api/v4/leads?limit=250&page=${page}&with=tags,contacts,companies${sinceFilter}`,
      )) as { _embedded?: { leads?: AmoLead[] } } | null;
      const pageLeads = dedupeByKey(pageData?._embedded?.leads ?? [], (l) => String(l.id));
      if (pageLeads.length === 0) break;

      // Filtered AFTER the pagination-continuation checks below (which key
      // off the raw fetched page size) — a page made entirely of leads in
      // an excluded pipeline must not be mistaken for "last page reached".
      const syncableLeads = conn.enabled_pipeline_ids
        ? pageLeads.filter((l) => conn.enabled_pipeline_ids!.includes(l.pipeline_id))
        : pageLeads;

      // Only fetch the contacts/companies this page's leads actually
      // reference, not the whole account's address book (see
      // fetchEntitiesByIds above).
      const referencedContactIds = new Set<number>();
      const referencedCompanyIds = new Set<number>();
      for (const l of syncableLeads) {
        const cId = amoMainContactId(l);
        const coId = amoMainCompanyId(l);
        if (cId) referencedContactIds.add(cId);
        if (coId) referencedCompanyIds.add(coId);
      }

      const [contactsById, companiesById] = await Promise.all([
        fetchEntitiesByIds<AmoContact>(conn, "contacts", Array.from(referencedContactIds)),
        fetchEntitiesByIds<AmoCompany>(conn, "companies", Array.from(referencedCompanyIds)),
      ]);

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
            .upsert(
              dedupeByKey(contactRows, (r) => String(r.amocrm_id)),
              { onConflict: "organization_id,amocrm_id" },
            )
            .select("id, amocrm_id");
          if (error) throw new Error(`[page ${page} contacts] ${describeError(error)}`);
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
            .upsert(
              dedupeByKey(companyRows, (r) => String(r.amocrm_id)),
              { onConflict: "organization_id,amocrm_id" },
            )
            .select("id, amocrm_id");
          if (error) throw new Error(`[page ${page} companies] ${describeError(error)}`);
          for (const row of data ?? []) {
            if (row.amocrm_id != null) companyIdMap.set(row.amocrm_id, row.id);
          }
        }
      }

      const rows = syncableLeads.map((l) => {
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
          // Was never set here before, so every AmoCRM-synced lead sat at
          // leads.funnel's column default ('Direct Sales') regardless of
          // which real AmoCRM pipeline it came from — collapsing every
          // pipeline into one funnel everywhere the app groups/filters by
          // funnel (Voronkalar, the pipeline board, Reyting's funnel
          // filter, ...).
          funnel: pipelineNameById.get(l.pipeline_id) ?? "Direct Sales",
          stage_id:
            stageByStatusId.get(pipelineStatusKey(l.pipeline_id, l.status_id)) ?? fallbackStageId,
          owner_id: l.responsible_user_id
            ? (ownerByAmoUserId.get(l.responsible_user_id) ?? null)
            : null,
          loss_reason:
            l.loss_reason_id != null ? (lossReasonById.get(l.loss_reason_id) ?? null) : null,
          priority: "Normal" as const,
          tags: amoTagNames(l),
        };
      });
      // Each AmoCRM page already caps at 250 leads, but that turned out to
      // be close enough to the same per-statement audit-trail overhead that
      // forced pipeline_stages down to 200-row chunks (see above) that a
      // single heavy account can still time out here. Chunk it the same way
      // rather than wait for a second report of the same failure mode.
      const LEADS_UPSERT_CHUNK = 100;
      const dedupedLeadRows = dedupeByKey(rows, (r) => String(r.amocrm_id));
      for (let i = 0; i < dedupedLeadRows.length; i += LEADS_UPSERT_CHUNK) {
        const chunk = dedupedLeadRows.slice(i, i + LEADS_UPSERT_CHUNK);
        if (chunk.length === 0) continue;
        const { error } = await supabaseAdmin
          .from("leads")
          .upsert(chunk, { onConflict: "organization_id,amocrm_id" });
        if (error)
          throw new Error(`[page ${page} leads ${i}-${i + chunk.length}] ${describeError(error)}`);
      }

      totalSynced += syncableLeads.length;
      if (pageLeads.length < 250) break; // short page — this was the last one
      page += 1;
    }

    let callsSynced = 0;
    // Call sync is best-effort -- a failure here shouldn't fail the whole
    // sync, since leads/contacts/companies are the primary purpose and just
    // proved they synced fine. But silently swallowing the reason (as this
    // used to) meant a real, ongoing call-sync bug (wrong API scope, wrong
    // note_type, an account with no telephony integration at all) looked
    // identical to "everything's fine" on the Integrations page forever.
    // Surface it in last_sync_error instead so it's visible without ever
    // marking the overall sync (leads) as failed.
    let callsSyncWarning: string | null = null;
    try {
      callsSynced = await syncCallsFromAmo(conn);
    } catch (err) {
      callsSyncWarning = `Calls: ${describeError(err)}`;
    }

    await supabaseAdmin
      .from("amocrm_connection")
      .update({ last_synced_at: new Date().toISOString(), last_sync_error: callsSyncWarning })
      .eq("organization_id", organizationId);
    await supabaseAdmin
      .from("integration_settings")
      .update({
        config: {
          subdomain: conn.subdomain,
          last_synced_at: new Date().toISOString(),
          lead_count: totalSynced,
        },
      })
      .eq("organization_id", organizationId)
      .eq("key", "amocrm");

    return { synced: totalSynced, callsSynced };
  } catch (err) {
    const message = describeError(err);
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

  // Unlike the leads loop, this was still one upsert for the whole (capped
  // but still up to ~5k-row) batch -- the same shape of statement that
  // forced pipeline_stages and the leads loop down to chunked upserts.
  // Chunk it too instead of waiting for this to be the next timeout report.
  const CALLS_UPSERT_CHUNK = 200;
  const dedupedCallRows = dedupeByKey(rows, (r) => String(r.amocrm_note_id));
  for (let i = 0; i < dedupedCallRows.length; i += CALLS_UPSERT_CHUNK) {
    const chunk = dedupedCallRows.slice(i, i + CALLS_UPSERT_CHUNK);
    const { error } = await supabaseAdmin
      .from("amocrm_calls")
      .upsert(chunk, { onConflict: "organization_id,amocrm_note_id" });
    if (error) throw new Error(`[calls ${i}-${i + chunk.length}] ${describeError(error)}`);
  }
  return rows.length;
}

type AmoTask = {
  id: number;
  entity_id: number;
  entity_type: string;
  complete_till: number;
  is_completed: boolean;
};

export type AmoTaskStats = { dueToday: number; overdue: number };

// Same "don't pull a whole account's history into one request" concern as
// fetchCallNotes -- caps the pull so a huge open-task backlog can't push a
// Dashboard load over the platform's memory/time limits.
const TASKS_MAX_PAGES = 20; // ~5k open tasks at limit=250

/**
 * Counts this org's open (incomplete) AmoCRM tasks into "due later today"
 * vs. "already overdue", optionally scoped to a single funnel by cross-
 * referencing each task's lead against the local leads table (AmoCRM tasks
 * carry no pipeline/funnel of their own -- only an entity_id/entity_type).
 */
export async function fetchOpenTaskStats(
  organizationId: string,
  funnel?: string | null,
): Promise<AmoTaskStats> {
  const conn0 = await getConnection(organizationId);
  if (!conn0) return { dueToday: 0, overdue: 0 };
  const conn = await ensureValidToken(conn0);

  const tasks = await fetchAllPaged<AmoTask>(
    conn,
    (page) => `/api/v4/tasks?filter[is_completed]=0&limit=250&page=${page}`,
    (data) => (data as { _embedded?: { tasks?: AmoTask[] } } | null)?._embedded?.tasks ?? [],
    TASKS_MAX_PAGES,
  );

  let relevant = tasks;
  if (funnel) {
    const { data: leadRows, error } = await supabaseAdmin
      .from("leads")
      .select("amocrm_id")
      .eq("organization_id", organizationId)
      .eq("funnel", funnel);
    if (error) throw error;
    const allowedAmoIds = new Set(
      (leadRows ?? []).map((l) => l.amocrm_id).filter((id): id is number => id != null),
    );
    relevant = tasks.filter((t) => t.entity_type === "leads" && allowedAmoIds.has(t.entity_id));
  }

  const now = Date.now() / 1000;
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const endOfTodayUnix = endOfToday.getTime() / 1000;

  let dueToday = 0;
  let overdue = 0;
  for (const t of relevant) {
    if (t.complete_till < now) overdue += 1;
    else if (t.complete_till <= endOfTodayUnix) dueToday += 1;
  }
  return { dueToday, overdue };
}

/**
 * Resolves a stage_id for a single AmoCRM status_id, falling back to the
 * org's "new" stage. Status ids alone aren't unique across pipelines
 * (won/lost are id 142/143 in every pipeline) — pass pipelineId when known
 * so this can disambiguate; without it, `.limit(1)` just takes whichever
 * pipeline's matching stage comes first, same as this always did before
 * pipeline-scoped stages existed, rather than erroring on multiple rows.
 */
export async function resolveStageId(
  organizationId: string,
  statusId: number | null,
  pipelineId: number | null = null,
): Promise<string | null> {
  if (statusId != null) {
    let query = supabaseAdmin
      .from("pipeline_stages")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("amocrm_status_id", statusId);
    if (pipelineId != null) query = query.eq("amocrm_pipeline_id", pipelineId);
    const { data } = await query.limit(1);
    if (data?.[0]?.id) return data[0].id;
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
  pipelineId: number | null = null,
) {
  const [stageId, ownerId] = await Promise.all([
    resolveStageId(organizationId, statusId, pipelineId),
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
      priority: "Normal" as const,
    },
    { onConflict: "organization_id,amocrm_id" },
  );
  if (error) throw error;
}

export type AmoCatalogPipeline = { id: number; name: string; is_main: boolean };
export type AmoCatalogOperator = {
  id: number;
  name: string;
  email: string | null;
  existingProfileEmail: string | null;
};
export type AmoCatalog = {
  subdomain: string;
  pipelines: AmoCatalogPipeline[];
  operators: AmoCatalogOperator[];
  enabledPipelineIds: number[] | null;
  enabledUserIds: number[] | null;
};

/** Live list of every AmoCRM pipeline/operator for the amocrm-import-settings admin page, plus the org's current selection. */
export async function fetchAmoCatalog(organizationId: string): Promise<AmoCatalog> {
  const conn0 = await getConnection(organizationId);
  if (!conn0) throw new Error("AmoCRM is not connected yet.");
  const conn = await ensureValidToken(conn0);

  const [pipelines, users, { data: profiles, error }] = await Promise.all([
    fetchPipelines(conn),
    fetchAllUsers(conn),
    supabaseAdmin.from("profiles").select("email").eq("organization_id", organizationId),
  ]);
  if (error) throw error;

  const existingEmails = new Set((profiles ?? []).map((p) => p.email.toLowerCase()));

  return {
    subdomain: conn.subdomain,
    pipelines: pipelines.map((p) => ({ id: p.id, name: p.name, is_main: !!p.is_main })),
    operators: users.map((u) => ({
      id: u.id,
      name: u.name?.trim() || u.email || `AmoCRM user #${u.id}`,
      email: u.email,
      existingProfileEmail: u.email && existingEmails.has(u.email.toLowerCase()) ? u.email : null,
    })),
    enabledPipelineIds: conn.enabled_pipeline_ids,
    enabledUserIds: conn.enabled_user_ids,
  };
}

/** Saves which AmoCRM pipelines/operators syncLeadsFromAmo should actually pull — see amocrm-import-settings. */
export async function saveAmoImportSettings(
  organizationId: string,
  enabledPipelineIds: number[],
  enabledUserIds: number[],
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("amocrm_connection")
    .update({
      enabled_pipeline_ids: enabledPipelineIds,
      enabled_user_ids: enabledUserIds,
    })
    .eq("organization_id", organizationId);
  if (error) throw error;
}

/** Removes the org's AmoCRM connection (and its access/refresh tokens) and flips integration_settings back off — see amocrm-import-settings' "Disconnect". */
export async function disconnectAmoCrm(organizationId: string): Promise<void> {
  const { error: connError } = await supabaseAdmin
    .from("amocrm_connection")
    .delete()
    .eq("organization_id", organizationId);
  if (connError) throw connError;

  const { error: settingsError } = await supabaseAdmin
    .from("integration_settings")
    .update({ enabled: false })
    .eq("organization_id", organizationId)
    .eq("key", "amocrm");
  if (settingsError) throw settingsError;
}
