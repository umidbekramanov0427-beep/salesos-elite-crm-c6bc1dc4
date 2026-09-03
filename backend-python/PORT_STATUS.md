# Python port status

## What this is

`salesos-elite-crm-c6bc1dc4` is currently one TypeScript codebase: a
TanStack Start app (React 19 + Vite, deployed as a Cloudflare Worker) whose
`src/routes/*.ts` files serve as backend API routes and whose `src/routes/*.tsx`
files are frontend pages, both talking to the same Supabase Postgres
database through `supabaseAdmin` (service-role, RLS-bypassing) or the
browser Supabase client (anon key, RLS-enforced).

This folder is a port of the **backend** (the `.ts` server routes and the
`src/lib/*.server.ts` / `src/lib/amocrm/*` business logic they call) to
Python/FastAPI, requested so a different developer can take the project
over. Every backend route is ported (see "Done" below) except `mcp.ts`,
which isn't really portable as a route at all -- see "Not started". It
reuses the exact same Supabase project (same schema, same RLS policies,
same data) -- nothing in the database changes.

**The frontend (all `.tsx` files, ~50 pages) is not part of this port and
does not need to be.** React/TypeScript only runs in a browser; there is no
meaningful sense in which a browser UI gets "converted to Python" short of
throwing out the entire existing, working, already-polished UI and
rebuilding it from scratch in a different paradigm (e.g. Django templates
or Streamlit) -- a separate, even larger project than this backend port,
not attempted here. The existing frontend is handed over as-is (it already
is source files, in the same git repo) and can keep talking to this new
Python backend exactly as it talks to the TypeScript one today, once the
backend exposes equivalent endpoints -- or the two can run side by side
during the transition.

## How porting works here

Every `src/routes/*.ts` file becomes one `backend-python/app/routers/*.py`
file with the same route path. Every `src/lib/*.server.ts` /
`src/lib/amocrm/client.server.ts` function becomes its Python equivalent
under `backend-python/app/`, called by whichever router(s) used the
original. `supabaseAdmin.from(...)` calls become
`get_supabase_admin().table(...)` calls (the official `supabase-py`
client, mirroring `supabase-js` almost 1:1) -- so ported code stays close
enough to the original to diff against it.

## Done

| Original | Port | Notes |
|---|---|---|
| `src/integrations/supabase/client.server.ts` | `app/db.py` | service-role client |
| `src/lib/auth.server.ts` | `app/auth.py` | token verification + super_admin/org-member checks; also added `require_cron_secret_dep` here, factoring out the identical `x-cron-secret` check every cron route repeated inline in the original -- not a new authorization rule, just deduplicated |
| `src/lib/google-sheets.server.ts` | `app/google_sheets.py` | uses `pyjwt` for RS256 signing instead of hand-rolled Web Crypto (the original's approach exists only because it targets Cloudflare Workers, which Python has no equivalent constraint for) |
| `src/lib/daily-report-builder.server.ts` | `app/daily_report_builder.py` | `build_full_daily_report` + `build_personal_daily_report`, including the Gemini narrative pass. The original's ~10 independent `Promise.all` selects run sequentially here (supabase-py's sync client) -- functionally identical, just not parallelized; see the module's own docstring |
| `src/lib/telegram-report.server.ts` | `app/telegram_report.py` | all of it: `send_telegram_message`, the HR-bot senders (photo/document/audio/location), `rehost_hr_telegram_file`, `send_daily_report_for_org`, `send_daily_report_to_linked_managers` |
| `src/routes/errors.log.ts` | `app/routers/errors.py` | simplest route, ported as the worked example |
| `src/routes/telegram.send-test.ts` | `app/routers/telegram.py` | |
| `src/routes/telegram.send-daily-report.ts` | `app/routers/telegram.py` | cron entry point |
| `src/routes/telegram.link.ts` | `app/routers/telegram.py` | chat-linking code exchange |
| `src/routes/telegram.webhook.ts` | `app/routers/telegram.py` | main bot: business-profile onboarding conversation + report-bot linking |
| `src/routes/telegram.hr-webhook.ts` | `app/routers/telegram_hr.py` | separate HR candidate-chat bot |
| `src/routes/hr.delete-candidate.ts` | `app/routers/hr.py` | |
| `src/routes/hr.send-message.ts` | `app/routers/hr.py` | |
| `src/routes/admin.create-employee.ts` | `app/routers/admin.py` | includes the org's password-policy check |
| `src/routes/admin.delete-employee.ts` | `app/routers/admin.py` | |
| `src/routes/admin.set-employee-password.ts` | `app/routers/admin.py` | syncs `organization_admin_credentials` when the target is a super_admin |
| `src/routes/admin.security-ban.ts` | `app/routers/admin.py` | uses `ban_duration` (no per-session revoke exists in the Admin API) |
| `src/routes/admin.security-users.ts` | `app/routers/admin.py` | only place `last_sign_in_at`/`banned_until` are exposed, org-scoped |
| `src/routes/admin.ai-agents.update.ts` | `app/routers/admin.py` | service-role write, sidesteps the client-side RLS issue the original worked around |
| `src/routes/platform.create-organization.ts` | `app/routers/platform.py` | multi-step create with rollback-on-failure (deletes the org/admin-user if a later step fails) |
| `src/routes/platform.add-employee.ts` | `app/routers/platform.py` | |
| `src/routes/platform.delete-user.ts` | `app/routers/platform.py` | |
| `src/routes/platform.update-user.ts` | `app/routers/platform.py` | |
| `src/routes/platform.company-directory.ts` | `app/routers/platform.py` | |
| `src/routes/platform.deactivate-expired-trials.ts` | `app/routers/platform.py` | |
| `src/routes/platform.delete-organization.ts` | `app/routers/platform.py` | |
| `src/lib/organization-admin-credentials.server.ts` | `app/organization_admin_credentials.py` | called from `admin.set-employee-password` and `platform.create-organization`/`.update-user` |
| `src/lib/auth.server.ts`'s `requirePlatformOwner` | `app/auth.py` (`require_platform_owner`) | added alongside the platform.* batch, since every platform route needs it |
| `src/routes/fines.compute.ts` | `app/routers/fines.py` | daily deterministic CRM-hygiene fines engine |
| `src/routes/fines.publish.ts` | `app/routers/fines.py` | |
| `src/routes/daily-report-settings.preview.ts` | `app/routers/daily_report_settings.py` | thin wrapper around `build_full_daily_report` |
| `src/routes/daily-report-settings.generate-now.ts` | `app/routers/daily_report_settings.py` | thin wrapper around `send_daily_report_for_org` |
| `src/lib/amocrm/client.server.ts` (client core) | `app/amocrm_client.py` | OAuth token lifecycle, per-org credential resolution, the low-level `amoFetch`/`amoWriteFetch` HTTP layer (with the original's rate-limit/5xx retry logic), webhook subscription, the debug helpers (`debugAmoAppCredentials`, `debugAmoCallNotes`, `setAmoAppCredentialsDirect`), `buildAuthorizeUrl`/`exchangeCodeForTokens`, and `createAmoTask`/`createAmoNote`/`hasHumanNoteSince` |
| `src/lib/amocrm/client.server.ts` (sync engine) | `app/amocrm_sync.py` | everything else: `syncLeadsFromAmo` (the core, ~470 lines), `syncPipelineStages`, `syncUserMapping` (incl. `sotuv_menejeri` auto-provisioning), `syncCallsFromAmo`, `backfillOrphanedCallLeads`, `fetchOpenTaskStats`, `syncTasksFromAmo`, `resolveStageId`/`resolveOwnerId`/`upsertSingleAmoLead`, `fetchAmoCatalog`, `saveAmoImportSettings`, `disconnectAmoCrm`. This is the module the original's own comments call out as the project's hardest-won code (stale composite-key migrations, blind config overwrites that silently wiped per-org credentials, pagination bugs that dropped entire sync batches on one bad page) -- every one of those original inline comments is preserved in the Python docstrings/comments here for the same reason they existed in the first place |
| `src/routes/integrations.amocrm.connect.ts` | `app/routers/amocrm.py` | OAuth authorize redirect + the 3 debug query-param branches |
| `src/routes/integrations.amocrm.callback.ts` | `app/routers/amocrm.py` | OAuth callback, stores tokens, read-modify-writes `integration_settings.config` |
| `src/routes/integrations.amocrm.sync.ts` | `app/routers/amocrm.py` | manual "sync now" trigger, always resolves to a JSON body even on an infra-level failure |
| `src/routes/integrations.amocrm.sync-all.ts` | `app/routers/amocrm.py` | cron entry point, syncs every connected org one at a time |
| `src/routes/integrations.amocrm.webhook.ts` | `app/routers/amocrm.py` | inbound AmoCRM webhook, incl. the `account[subdomain]` anti-spoofing check and throttled quick-resync |
| `src/routes/admin.amocrm-catalog.ts` | `app/routers/amocrm.py` | |
| `src/routes/admin.amocrm-disconnect.ts` | `app/routers/amocrm.py` | |
| `src/routes/admin.amocrm-import-settings.ts` | `app/routers/amocrm.py` | |
| `src/routes/dashboard.amocrm-tasks.ts` | `app/routers/amocrm.py` | |
| `src/routes/audio-analytics.analyze.ts` | `app/audio_analytics.py` + `app/routers/audio_analytics.py` | the route handler is a thin wrapper in the router file; all the transcription/rubric/Gemini-scoring logic is in `app/audio_analytics.py` (`analyze_call_by_id`), same split as the original's route-vs-exported-function |
| `src/routes/audio-analytics.analyze-pending.ts` | `app/routers/audio_analytics.py` | cron sweep, analyzed concurrently via `asyncio.gather` (`Promise.allSettled` in the original) |
| `src/routes/ai-assistant.chat.ts` | `app/routers/ai_assistant.py` | AI assistant chat + the 5 function-calling tools (search_leads, get_funnel_stats, create_my_task, add_lead_note, update_lead_stage); no AmoCRM dependency |
| `src/routes/notifications.send-push.ts` | `app/routers/misc.py` | uses `pywebpush` (Python VAPID web-push library) in place of the original's `web-push` npm package |
| `src/routes/sitemap[.]xml.ts` | `app/routers/misc.py` | |

Verified after each addition: `py_compile` on every file, a real
`pip install -r requirements.txt`, and `from app.main import app` booting
with dummy env vars, confirming every new route actually registers.

## Not started -- everything is ported except one route that isn't really portable as "a route"

Every backend route from the original TypeScript app now has a Python
equivalent, **except** `src/routes/mcp.ts`:

- `src/routes/mcp.ts` -- **deliberately not ported, and not really portable as "a route"**: this file is an
  auto-generated, ~15-line wrapper around Lovable's own `@lovable.dev/mcp-js`
  framework (`createTanStackMcpHandler`), which handles the actual Model
  Context Protocol transport (JSON-RPC, SSE), OAuth-protected-resource
  metadata, and per-tool-call auth context (`ToolContext.getUserId()`) --
  none of that is hand-written business logic sitting in this codebase to
  translate; it's a framework/hosting decision. The 4 tools it exposes
  (`src/lib/mcp/tools/list-leads.ts`, `get-lead.ts`, `pipeline-summary.ts`,
  `leaderboard.ts`, plus the shared `org-scope.ts` auth helper) are each
  just a small, ordinary org-scoped Supabase query -- straightforward to
  port as plain Python functions -- but wiring them up as actual MCP tools
  again requires picking a Python MCP server framework first (e.g. the
  official `modelcontextprotocol/python-sdk`), which is a decision for
  whoever continues this port, not something to guess at here.

### Data layer shared by nearly everything above
- `src/hooks/use-crm-data.ts` (~6,900 lines) -- this is technically a
  **frontend** file (React Query hooks calling the browser Supabase client
  directly with RLS enforced, not through any `src/routes/*.ts` backend
  route). It is *not* part of this backend port. It's listed here only so
  whoever picks this up understands why so much business logic (e.g. all
  the Reyting/Dashboard/Funnels aggregation) has no server-route
  counterpart to port at all -- it never had one. If the new backend is
  meant to fully replace the browser's direct Supabase access too (a much
  bigger decision than "port the backend routes"), every hook in this file
  becomes a new FastAPI endpoint from scratch, not a port of an existing
  one.

## What's deliberately NOT being re-derived from scratch

Do **not** re-implement RLS-equivalent authorization by re-reading the
Postgres policies and guessing intent. The exact authorization rule for
each table already exists twice: once as the actual RLS policy (in
`supabase/migrations/*.sql`), and once as the TypeScript route's own extra
checks (most routes use the service-role client specifically to bypass
RLS, then re-check role/org manually -- see `app/auth.py`'s docstring).
Port the TypeScript route's checks line-for-line; don't invent new ones.

## Continuing from here

The backend port itself is complete. What's left for whoever picks this
up:

1. **Validate the AmoCRM sync engine against a real (or scratch)
   AmoCRM-connected org before trusting it in production.** This port
   (`app/amocrm_sync.py` + `app/amocrm_client.py` + `app/routers/amocrm.py`)
   was written by reading the original `client.server.ts` end to end and
   translating it function-by-function, preserving every inline comment's
   reasoning, but it has **not** been run against a live AmoCRM account
   from this environment (no credentials available here). This is the
   single highest-risk area of the whole port -- the original's own header
   comment calls it the source of most of this project's hardest bugs, and
   a rushed, unvalidated Python rewrite of it is exactly the kind of thing
   that comment warns about. Connect a test org, run a full sync, and
   compare its `leads`/`amocrm_calls`/`tasks`/`pipeline_stages` output
   against what the TypeScript version produces for the same account
   before switching any real traffic over.
2. **`src/routes/mcp.ts`**, if the new backend should also expose MCP tools
   -- pick a Python MCP SDK first (see the section above), then port the 4
   small query functions behind it.
3. **The frontend** (`src/routes/*.tsx`, ~50 pages) -- out of scope for
   this port entirely; see "What this is" at the top of this file for why.
4. **`src/hooks/use-crm-data.ts`** -- only relevant if a future decision is
   made to move the browser off direct Supabase access onto this backend
   too; see the section above.

General note from doing this port in batches: **a route's dependencies
were always ported together with the route**, not route-by-route in
isolation -- `telegram.send-test.ts` alone was trivial, but meaningless
without `daily-report-builder.server.ts` behind it; `audio-analytics.
analyze.ts` needed the AmoCRM "client core" ported alongside it, ahead of
the rest of that subsystem, for the same reason. Follow the actual
`import` graph of a `.ts` file, not a subsystem grouping, when figuring
out what porting anything new here actually requires.

## Running what exists

```bash
cd backend-python
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in real values -- see the main repo's
                        # deployed environment variables for what they are
uvicorn app.main:app --reload
```

`GET /health` should return `{"status": "ok"}`. See the Done table above
for all 44 real ported endpoints and what each does; every one matches its
original TypeScript route's request/response shape.
