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
| `src/lib/auth.server.ts` | `app/auth.py` | token verification + super_admin/org-member checks |
| `src/routes/errors.log.ts` | `app/routers/errors.py` | simplest route, ported as the worked example |

## Not started -- every other backend route (36 of 39)

Grouped by subsystem, in the rough order they're worth porting next (most
self-contained / highest value first). File sizes are the original
TypeScript, as a rough effort signal.

### AmoCRM integration (the largest, most fought-over subsystem this project has -- port last, most carefully)
- `src/lib/amocrm/client.server.ts` (~2,100 lines) -- OAuth token exchange/
  refresh, per-org credential resolution, leads/contacts/companies/pipeline/
  calls/tasks sync, webhook subscription, all the `createAmoTask`/
  `createAmoNote`/`hasHumanNoteSince` helpers. This is the one module worth
  the most care: it has been the source of most of this project's hardest
  bugs this year (stale composite-key migrations, blind config overwrites
  that silently wiped per-org credentials, pagination bugs that dropped
  entire sync batches on one bad page). Read its inline comments carefully
  before touching it -- almost every non-obvious line documents a real bug
  that was fixed there.
- `src/routes/integrations.amocrm.connect.ts` -- OAuth authorize redirect + debug endpoints
- `src/routes/integrations.amocrm.callback.ts` -- OAuth callback, stores tokens
- `src/routes/integrations.amocrm.sync.ts` -- manual "sync now" trigger
- `src/routes/integrations.amocrm.sync-all.ts` -- cron entry point (all orgs)
- `src/routes/integrations.amocrm.webhook.ts` -- inbound AmoCRM webhook handler
- `src/routes/admin.amocrm-catalog.ts`
- `src/routes/admin.amocrm-disconnect.ts`
- `src/routes/admin.amocrm-import-settings.ts`
- `src/routes/dashboard.amocrm-tasks.ts`

### AI / audio analysis
- `src/routes/audio-analytics.analyze.ts` -- Gemini call-transcript analysis, structured scoring, auto AmoCRM note/task creation
- `src/routes/audio-analytics.analyze-pending.ts` -- cron sweep for unanalyzed calls
- `src/routes/ai-assistant.chat.ts` -- AI assistant chat endpoint (loads a data snapshot, calls Gemini)
- `src/routes/fines.compute.ts` -- daily deterministic CRM-hygiene fines engine (see its own extensive header comment on why it's deterministic, not AI-judged)
- `src/routes/fines.publish.ts` -- Telegram broadcast of a fines summary
- `src/routes/daily-report-settings.preview.ts`, `.generate-now.ts` and `src/lib/daily-report-builder.server.ts` -- the daily report generator (aggregates + AI narrative)

### Telegram
- `src/routes/telegram.webhook.ts` -- main bot (business-profile onboarding conversation, report bot linking)
- `src/routes/telegram.hr-webhook.ts` -- separate HR candidate-chat bot
- `src/routes/telegram.link.ts`
- `src/routes/telegram.send-daily-report.ts` -- cron entry point
- `src/routes/telegram.send-test.ts`
- `src/lib/telegram-report.server.ts` -- shared `sendTelegramMessage` helper

### Admin / platform (multi-tenant org management)
- `src/routes/admin.create-employee.ts`, `.delete-employee.ts`, `.set-employee-password.ts`
- `src/routes/admin.security-ban.ts`, `.security-users.ts`
- `src/routes/admin.ai-agents.update.ts`
- `src/routes/platform.create-organization.ts` -- creates org + first Super Admin + ROP
- `src/routes/platform.add-employee.ts`, `.delete-user.ts`, `.update-user.ts`
- `src/routes/platform.company-directory.ts`
- `src/routes/platform.deactivate-expired-trials.ts`
- `src/routes/platform.delete-organization.ts`
- `src/lib/organization-admin-credentials.server.ts` -- keeps org owner-login passwords in sync across 3 places

### HR (candidate hiring pipeline)
- `src/routes/hr.delete-candidate.ts`
- `src/routes/hr.send-message.ts`

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

1. Finish `app/auth.py` parity (there are a couple more TS auth helpers not
   yet ported, e.g. `getAmoRedirectUri`-style small utilities scattered in
   `client.server.ts` -- port them alongside whichever router needs them
   first, not preemptively).
2. Telegram (`telegram.send-test.ts` first -- smallest, no business logic,
   good second worked example after `errors.log.ts`).
3. Admin/platform CRUD routes -- mostly straightforward `supabaseAdmin`
   insert/update/delete calls with a role check, low risk.
4. AI/audio analysis -- port `daily-report-builder.server.ts` before
   `audio-analytics.analyze.ts`; the latter is the more complex one and
   reuses patterns from the former.
5. AmoCRM last, and slowest -- budget real time to re-read every inline
   comment in `client.server.ts` before changing behavior, and validate
   against a real (or scratch) AmoCRM-connected org before considering any
   piece of it done. This module has burned the most hours of any in the
   project's history; a rushed port here is where regressions are most
   likely.

## Running what exists so far

```bash
cd backend-python
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in real values -- see the main repo's
                        # deployed environment variables for what they are
uvicorn app.main:app --reload
```

`GET /health` should return `{"status": "ok"}`. `POST /errors/log` is the
one real ported endpoint so far -- same request/response shape as the
original `POST /errors/log` in the TypeScript app.
