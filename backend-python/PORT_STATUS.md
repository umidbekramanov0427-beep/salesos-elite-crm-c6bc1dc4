# Python port status

## What this is

`salesos-elite-crm-c6bc1dc4` is currently one TypeScript codebase: a
TanStack Start app (React 19 + Vite, deployed as a Cloudflare Worker) whose
`src/routes/*.ts` files serve as backend API routes and whose `src/routes/*.tsx`
files are frontend pages, both talking to the same Supabase Postgres
database through `supabaseAdmin` (service-role, RLS-bypassing) or the
browser Supabase client (anon key, RLS-enforced).

This folder is the start of a port of the **backend** (the `.ts` server
routes and the `src/lib/*.server.ts` / `src/lib/amocrm/*` business logic
they call) to Python/FastAPI, requested so a different developer can take
the project over. It reuses the exact same Supabase project (same schema,
same RLS policies, same data) -- nothing in the database changes.

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
| **partial** `src/lib/amocrm/client.server.ts` | `app/amocrm_client.py` | **only the "client core"** -- OAuth token lifecycle, per-org credential resolution, the low-level amoFetch/amoWriteFetch HTTP layer, webhook subscription, and `create_amo_task`/`create_amo_note`/`has_human_note_since`. Ported now (out of the "AmoCRM last" order below) because `audio-analytics.analyze.ts` hard-depends on those three write/read helpers -- see that module's own docstring for exactly what of the ~2,100-line original is and isn't here. The bidirectional sync engine (`syncLeadsFromAmo` and everything it calls) is **not** ported -- still in "Not started" below, unchanged priority (last, most carefully) |
| `src/routes/audio-analytics.analyze.ts` | `app/audio_analytics.py` + `app/routers/audio_analytics.py` | the route handler is a thin wrapper in the router file; all the transcription/rubric/Gemini-scoring logic is in `app/audio_analytics.py` (`analyze_call_by_id`), same split as the original's route-vs-exported-function |
| `src/routes/audio-analytics.analyze-pending.ts` | `app/routers/audio_analytics.py` | cron sweep, analyzed concurrently via `asyncio.gather` (`Promise.allSettled` in the original) |
| `src/routes/ai-assistant.chat.ts` | `app/routers/ai_assistant.py` | AI assistant chat + the 5 function-calling tools (search_leads, get_funnel_stats, create_my_task, add_lead_note, update_lead_stage); no AmoCRM dependency |

Verified after each addition: `py_compile` on every file, a real
`pip install -r requirements.txt`, and `from app.main import app` booting
with dummy env vars, confirming every new route actually registers.

## Not started -- every other backend route (11 of 39)

Grouped by subsystem, in the rough order they're worth porting next (most
self-contained / highest value first). File sizes are the original
TypeScript, as a rough effort signal.

### AmoCRM integration -- the sync engine (the largest, most fought-over subsystem this project has -- port last, most carefully)
The "client core" (OAuth tokens, `amoFetch`/`amoWriteFetch`, webhook
subscribe, `createAmoTask`/`createAmoNote`/`hasHumanNoteSince`) is already
ported -- see `app/amocrm_client.py` in the Done table above. What's left
is the bidirectional **sync engine** built on top of it, still entirely in
the original TypeScript:
- `src/lib/amocrm/client.server.ts`'s `syncLeadsFromAmo` and everything it
  calls (~900 more lines): `syncPipelineStages`, `syncUserMapping` (incl.
  auto-provisioning `sotuv_menejeri` accounts), `fetchCallNotes`/
  `syncCallsFromAmo`, `syncTasksFromAmo`, `backfillOrphanedCallLeads`,
  `fetchOpenTaskStats`, `resolveStageId`/`resolveOwnerId`/
  `upsertSingleAmoLead`, `fetchAmoCatalog`, `saveAmoImportSettings`,
  `disconnectAmoCrm`, plus the OAuth authorize-URL/code-exchange helpers
  (`buildAuthorizeUrl`, `exchangeCodeForTokens`) and the three debug
  helpers (`debugAmoAppCredentials`, `debugAmoCallNotes`,
  `setAmoAppCredentialsDirect`). This is the one module worth the most
  care: it has been the source of most of this project's hardest bugs this
  year (stale composite-key migrations, blind config overwrites that
  silently wiped per-org credentials, pagination bugs that dropped entire
  sync batches on one bad page). Read its inline comments carefully before
  touching it -- almost every non-obvious line documents a real bug that
  was fixed there.
- `src/routes/integrations.amocrm.connect.ts` -- OAuth authorize redirect + debug endpoints
- `src/routes/integrations.amocrm.callback.ts` -- OAuth callback, stores tokens
- `src/routes/integrations.amocrm.sync.ts` -- manual "sync now" trigger
- `src/routes/integrations.amocrm.sync-all.ts` -- cron entry point (all orgs)
- `src/routes/integrations.amocrm.webhook.ts` -- inbound AmoCRM webhook handler
- `src/routes/admin.amocrm-catalog.ts`
- `src/routes/admin.amocrm-disconnect.ts`
- `src/routes/admin.amocrm-import-settings.ts`
- `src/routes/dashboard.amocrm-tasks.ts`

### Admin / platform (multi-tenant org management)
All ported -- see the Done table above.

### HR (candidate hiring pipeline)
All ported -- see the Done table above.

### Telegram
All ported -- see the Done table above.

### AI / audio analysis
All ported -- see the Done table above.

### Misc
- `src/routes/notifications.send-push.ts`
- `src/routes/mcp.ts` -- Model Context Protocol server (exposes CRM data/actions to external AI clients)
- `src/routes/sitemap[.]xml.ts`
- `src/lib/google-sheets.server.ts` -- Google Sheets export

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

## Suggested order for continuing this port

Everything except the AmoCRM sync engine is now done -- see the Done table
above. What's left is entirely that one subsystem:

1. Start with `resolveStageId`/`resolveOwnerId`/`upsertSingleAmoLead` and
   `fetchAmoCatalog`/`saveAmoImportSettings`/`disconnectAmoCrm` -- these are
   comparatively small and self-contained, and a good way to get familiar
   with the rest of the module's conventions (dedup-by-key upserts,
   `describeError`, chunked writes) before the big one.
2. Then `syncPipelineStages` and `syncUserMapping` (incl. the
   `sotuv_menejeri` auto-provisioning logic -- note `amocrm_client.py`
   already has the shared `SOTUV_MENEJERI_DEFAULT_PASSWORD` convention
   documented, mirror it rather than re-deriving it) -- both are
   dependencies of the big one next.
3. `syncLeadsFromAmo` itself (~470 lines) -- the core of the whole module.
   Budget real time to re-read every inline comment in `client.server.ts`
   before changing behavior: almost every non-obvious line there documents
   a real production bug that was fixed (stale composite-key migrations,
   blind config overwrites that silently wiped per-org credentials,
   pagination bugs that dropped entire sync batches on one bad page).
4. `syncCallsFromAmo`, `backfillOrphanedCallLeads`, `fetchOpenTaskStats`,
   `syncTasksFromAmo`.
5. The 9 route files last, once their business logic exists to call:
   `integrations.amocrm.connect/callback/sync/sync-all/webhook.ts`,
   `admin.amocrm-catalog/-disconnect/-import-settings.ts`,
   `dashboard.amocrm-tasks.ts`. Validate against a real (or scratch)
   AmoCRM-connected org before considering any piece of this done -- this
   module has burned the most hours of any in the project's history, and a
   rushed port here is where regressions are most likely.

General note learned while doing the earlier batches: **port a route's
dependencies together with the route**, not route-by-route in isolation --
`telegram.send-test.ts` alone was trivial, but meaningless without
`daily-report-builder.server.ts` behind it; `audio-analytics.analyze.ts`
needed the AmoCRM "client core" (`app/amocrm_client.py`) ported alongside
it out of the normal subsystem order for the same reason. Follow the
actual `import` graph of each `src/routes/*.ts` file, not just the route
list above, when deciding what "porting this route" actually requires.

## Running what exists so far

```bash
cd backend-python
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in real values -- see the main repo's
                        # deployed environment variables for what they are
uvicorn app.main:app --reload
```

`GET /health` should return `{"status": "ok"}`. See the Done table above
for the 33 real ported endpoints and what each does; every one matches its
original TypeScript route's request/response shape.
