import { createFileRoute } from "@tanstack/react-router";
import { getRequestUserId } from "@/lib/auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ChatMessage = { role: "user" | "assistant"; content: string };

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(`Missing environment variable: ${name}. Add it in Settings -> Secrets.`);
  return value;
}

type LeadSnap = {
  stage_id: string | null;
  temperature: string;
  expected_revenue: number;
  owner_id: string | null;
};
type DealSnap = { stage_id: string | null; status: string; value: number; owner_id: string | null };
type TaskSnap = { status: string; due_date: string | null; assignee_id: string | null };
type StageRow = { id: string; name: string; is_won: boolean; is_lost: boolean };

// Reconstructs the latest-known state of every row of `entityType` at or
// before `asOf`, straight from the audit trail — same idea as the
// entities_as_of() RPC, but done in JS so it can run under the service-role
// client (the RPC's internal current_user_org_id() check only resolves for
// a real user session, not service-role calls, since auth.uid() is null there).
async function reconstructAsOf<T>(orgId: string, entityType: string, asOf: string): Promise<T[]> {
  const { data: rows } = await supabaseAdmin
    .from("audit_logs")
    .select("entity_id, action, meta, created_at")
    .eq("organization_id", orgId)
    .eq("entity_type", entityType)
    .lte("created_at", asOf)
    .order("created_at", { ascending: true });

  const latest = new Map<string, { action: string; meta: { new?: T } }>();
  for (const row of rows ?? []) {
    latest.set(row.entity_id as string, row as { action: string; meta: { new?: T } });
  }
  const out: T[] = [];
  for (const row of latest.values()) {
    if (row.action !== "delete" && row.meta?.new) out.push(row.meta.new);
  }
  return out;
}

// null = unrestricted (super_admin/platform_owner sees the whole company).
// A rop only ever gets their own subordinates' data, a sotuv_menejeri only
// their own — same scoping the rest of the app applies at the client-hook
// layer, mirrored here since this snapshot is built with the service-role
// client and bypasses RLS entirely.
async function visibleOwnerIds(
  orgId: string,
  callerId: string,
  role: string,
): Promise<string[] | null> {
  if (role === "super_admin" || role === "platform_owner") return null;
  if (role === "rop") {
    const { data: reports } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("organization_id", orgId)
      .eq("manager_id", callerId);
    return [callerId, ...(reports ?? []).map((r) => r.id)];
  }
  return [callerId];
}

async function loadDataSnapshot(
  orgId: string,
  asOf: string | null,
  ownerIds: string[] | null,
): Promise<string> {
  const { data: stages } = await supabaseAdmin
    .from("pipeline_stages")
    .select("id, name, is_won, is_lost")
    .eq("organization_id", orgId);
  const stageById = new Map((stages ?? []).map((s: StageRow) => [s.id, s]));

  let leads: LeadSnap[];
  let deals: DealSnap[];
  let tasks: TaskSnap[];

  if (asOf) {
    [leads, deals, tasks] = await Promise.all([
      reconstructAsOf<LeadSnap>(orgId, "leads", asOf),
      reconstructAsOf<DealSnap>(orgId, "deals", asOf),
      reconstructAsOf<TaskSnap>(orgId, "tasks", asOf),
    ]);
  } else {
    const [leadsRes, dealsRes, tasksRes] = await Promise.all([
      supabaseAdmin
        .from("leads")
        .select("stage_id, temperature, expected_revenue, owner_id")
        .eq("organization_id", orgId),
      supabaseAdmin
        .from("deals")
        .select("stage_id, status, value, owner_id")
        .eq("organization_id", orgId),
      supabaseAdmin
        .from("tasks")
        .select("status, due_date, assignee_id")
        .eq("organization_id", orgId),
    ]);
    leads = leadsRes.data ?? [];
    deals = dealsRes.data ?? [];
    tasks = tasksRes.data ?? [];
  }

  if (ownerIds) {
    const owners = new Set(ownerIds);
    leads = leads.filter((l) => l.owner_id && owners.has(l.owner_id));
    deals = deals.filter((d) => d.owner_id && owners.has(d.owner_id));
    tasks = tasks.filter((t) => t.assignee_id && owners.has(t.assignee_id));
  }

  const leadCountByStage = new Map<string, number>();
  let leadRevenue = 0;
  for (const l of leads) {
    const stageName = (l.stage_id && stageById.get(l.stage_id)?.name) || "No stage";
    leadCountByStage.set(stageName, (leadCountByStage.get(stageName) ?? 0) + 1);
    leadRevenue += l.expected_revenue ?? 0;
  }

  let dealsWon = 0;
  let dealsLost = 0;
  let dealsOpen = 0;
  let dealValueOpen = 0;
  let dealValueWon = 0;
  for (const d of deals) {
    const stage = d.stage_id ? stageById.get(d.stage_id) : null;
    if (stage?.is_won || d.status === "won") {
      dealsWon++;
      dealValueWon += d.value ?? 0;
    } else if (stage?.is_lost || d.status === "lost") {
      dealsLost++;
    } else {
      dealsOpen++;
      dealValueOpen += d.value ?? 0;
    }
  }

  const asOfMoment = asOf ? new Date(asOf) : new Date();
  let tasksDone = 0;
  let tasksOpen = 0;
  let tasksOverdue = 0;
  for (const t of tasks) {
    if (t.status === "Done") {
      tasksDone++;
    } else {
      tasksOpen++;
      if (t.due_date && new Date(t.due_date) < asOfMoment) tasksOverdue++;
    }
  }

  const lines = [
    asOf
      ? `CRM data snapshot as it stood on ${asOfMoment.toISOString().slice(0, 10)} (the user has selected this past date to review — answer using ONLY these historical numbers, not current live figures):`
      : "Current live CRM data snapshot:",
    `- Leads: ${leads.length} total, ${leadRevenue.toLocaleString("en-US")} total expected revenue. By stage: ${
      [...leadCountByStage.entries()].map(([name, count]) => `${name} (${count})`).join(", ") ||
      "none"
    }`,
    `- Deals: ${dealsOpen} open (value ${dealValueOpen.toLocaleString("en-US")}), ${dealsWon} won (value ${dealValueWon.toLocaleString("en-US")}), ${dealsLost} lost`,
    `- Tasks: ${tasksOpen} open (${tasksOverdue} overdue), ${tasksDone} done`,
  ];
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* Tool use -- the assistant used to be read-only advice. These let it   */
/* actually act on the caller's behalf: look up a lead, leave a note,    */
/* move a stage, or create a task for themselves. Every tool is scoped   */
/* to the same ownerIds visibility the data snapshot above already      */
/* uses, and task creation is always self-assigned (never lets the AI    */
/* assign work to someone else -- that would need reconstructing the     */
/* full manager/rep assignment RLS rule here, which isn't worth the risk */
/* for a chat tool call).                                                */
/* ------------------------------------------------------------------ */

type ToolContext = { orgId: string; callerId: string; ownerIds: string[] | null };

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_leads",
      description:
        "Search the caller's visible leads by name or company name. Call this first to find a lead's id before using add_lead_note or update_lead_stage.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Part of the lead's name or company name" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_my_task",
      description:
        "Create a new task assigned to the current user (the person chatting). Use this when they ask you to remind them of something or create a task/to-do for themselves.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          due_date: { type: "string", description: "ISO date, e.g. 2026-08-25. Optional." },
          lead_id: {
            type: "string",
            description: "Optional lead id (from search_leads) to attach this task to.",
          },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_lead_note",
      description:
        "Add a note to a lead's activity timeline. Requires the lead's id -- call search_leads first if you don't already have it from this conversation.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string" },
          note: { type: "string" },
        },
        required: ["lead_id", "note"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_lead_stage",
      description:
        "Move a lead to a different pipeline stage by name (the stage must belong to that lead's own funnel). Requires the lead's id -- call search_leads first if you don't already have it.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string" },
          stage_name: { type: "string" },
        },
        required: ["lead_id", "stage_name"],
      },
    },
  },
] as const;

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<unknown> {
  const inScope = (ownerId: string | null) =>
    !ctx.ownerIds || (ownerId != null && ctx.ownerIds.includes(ownerId));

  if (name === "search_leads") {
    const query = String(args["query"] ?? "").trim();
    if (!query) return { error: "query is required" };
    const { data } = await supabaseAdmin
      .from("leads")
      .select("id, name, company_name, stage_id, owner_id, temperature")
      .eq("organization_id", ctx.orgId)
      .or(`name.ilike.%${query}%,company_name.ilike.%${query}%`)
      .limit(20);
    const rows = (data ?? []).filter((l) => inScope(l.owner_id)).slice(0, 5);
    if (rows.length === 0) return { results: [] };
    const stageIds = [...new Set(rows.map((r) => r.stage_id).filter(Boolean))] as string[];
    const { data: stages } = stageIds.length
      ? await supabaseAdmin.from("pipeline_stages").select("id, name").in("id", stageIds)
      : { data: [] };
    const stageById = new Map((stages ?? []).map((s) => [s.id, s.name]));
    return {
      results: rows.map((l) => ({
        id: l.id,
        name: l.name,
        company: l.company_name,
        stage: l.stage_id ? (stageById.get(l.stage_id) ?? null) : null,
        temperature: l.temperature,
      })),
    };
  }

  if (name === "create_my_task") {
    const title = String(args["title"] ?? "").trim();
    if (!title) return { error: "title is required" };
    const leadId = typeof args["lead_id"] === "string" ? args["lead_id"] : null;
    if (leadId) {
      const { data: lead } = await supabaseAdmin
        .from("leads")
        .select("id, owner_id, organization_id")
        .eq("id", leadId)
        .maybeSingle();
      if (!lead || lead.organization_id !== ctx.orgId || !inScope(lead.owner_id)) {
        return { error: "Unknown lead_id." };
      }
    }
    const { data, error } = await supabaseAdmin
      .from("tasks")
      .insert({
        organization_id: ctx.orgId,
        title,
        assignee_id: ctx.callerId,
        created_by: ctx.callerId,
        due_date: typeof args["due_date"] === "string" ? args["due_date"] : null,
        lead_id: leadId,
      })
      .select("id")
      .maybeSingle();
    if (error) return { error: error.message };
    return { created: true, task_id: data?.id };
  }

  if (name === "add_lead_note") {
    const leadId = String(args["lead_id"] ?? "");
    const note = String(args["note"] ?? "").trim();
    if (!leadId || !note) return { error: "lead_id and note are required" };
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("id, owner_id, organization_id")
      .eq("id", leadId)
      .maybeSingle();
    if (!lead || lead.organization_id !== ctx.orgId || !inScope(lead.owner_id)) {
      return { error: "Unknown lead_id." };
    }
    const { error } = await supabaseAdmin.from("lead_activities").insert({
      lead_id: leadId,
      organization_id: ctx.orgId,
      type: "note",
      content: note,
      created_by: ctx.callerId,
    });
    if (error) return { error: error.message };
    return { added: true };
  }

  if (name === "update_lead_stage") {
    const leadId = String(args["lead_id"] ?? "");
    const stageName = String(args["stage_name"] ?? "").trim();
    if (!leadId || !stageName) return { error: "lead_id and stage_name are required" };
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("id, owner_id, organization_id, stage_id")
      .eq("id", leadId)
      .maybeSingle();
    if (!lead || lead.organization_id !== ctx.orgId || !inScope(lead.owner_id)) {
      return { error: "Unknown lead_id." };
    }
    const { data: currentStage } = lead.stage_id
      ? await supabaseAdmin
          .from("pipeline_stages")
          .select("pipeline_name")
          .eq("id", lead.stage_id)
          .maybeSingle()
      : { data: null };
    let stageQuery = supabaseAdmin
      .from("pipeline_stages")
      .select("id, name, pipeline_name")
      .eq("organization_id", ctx.orgId)
      .ilike("name", stageName);
    if (currentStage?.pipeline_name) {
      stageQuery = stageQuery.eq("pipeline_name", currentStage.pipeline_name);
    }
    const { data: targetStages } = await stageQuery.limit(1);
    const target = targetStages?.[0];
    if (!target) return { error: `No stage named "${stageName}" found in this lead's funnel.` };
    const { error } = await supabaseAdmin
      .from("leads")
      .update({ stage_id: target.id })
      .eq("id", leadId);
    if (error) return { error: error.message };
    return { moved: true, new_stage: target.name };
  }

  return { error: `Unknown tool: ${name}` };
}

// Gemini's function-calling shape, not OpenAI's -- matches the provider
// audio-analytics.analyze.ts already uses successfully (GEMINI_API_KEY).
// This used to call DeepSeek directly; that account ran out of balance
// (every request failing with a 402) and was never actually switched over
// when the rest of the platform's AI features moved to Gemini.
type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args?: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };
type GeminiContent = { role: "user" | "model" | "function"; parts: GeminiPart[] };

export const Route = createFileRoute("/ai-assistant/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await getRequestUserId(request);
        if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const body = (await request.json().catch(() => ({}))) as {
          messages?: ChatMessage[];
          asOf?: string | null;
        };
        const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
        const asOf = typeof body.asOf === "string" ? body.asOf : null;
        if (messages.length === 0) {
          return Response.json({ error: "No messages provided." }, { status: 400 });
        }

        let apiKey: string;
        try {
          apiKey = requireEnv("GEMINI_API_KEY");
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Missing GEMINI_API_KEY" },
            { status: 500 },
          );
        }

        const { data: caller } = await supabaseAdmin
          .from("profiles")
          .select("organization_id, role")
          .eq("id", userId)
          .maybeSingle();

        const { data: profile } = caller?.organization_id
          ? await supabaseAdmin
              .from("business_profile")
              .select("company_name, description, competitors, terminology, tone")
              .eq("organization_id", caller.organization_id)
              .maybeSingle()
          : { data: null };

        // Admin > AI agentlar > "Chat" toggle/prompt used to be stored but never
        // actually read here -- turning it off or customizing it in the admin UI
        // had zero effect on this endpoint (only the "Call" agent was wired, in
        // audio-analytics.analyze.ts). Wired the same way now.
        const { data: chatAgent } = caller?.organization_id
          ? await supabaseAdmin
              .from("ai_agents")
              .select("system_prompt, active")
              .eq("organization_id", caller.organization_id)
              .eq("kind", "chat")
              .maybeSingle()
          : { data: null };
        if (chatAgent && chatAgent.active === false) {
          return Response.json(
            { error: "AI yordamchi admin tomonidan o'chirilgan. Admin panelidan yoqing." },
            { status: 400 },
          );
        }

        const NAV_GUIDE = `- / — Leaderboard: live revenue ranking, KPI and bonus per rep
- /dashboard — Dashboard: today's/monthly revenue, pipeline value, recent activity
- /crm/leads — Leads register (search, filters, bulk actions)
- /crm/leads/$leadId — a single lead's full workspace: info, timeline, notes, tasks, AmoCRM link, call history, AI analysis
- /crm/contacts — Contacts
- /crm/companies — Companies
- /crm/deals — Deals
- /crm-stages — Permissions matrix: which roles can do what
- /funnels — Funnels: pipeline visualization and stage conversion
- /crm/pipeline — AmoCRM: drag-and-drop pipeline board synced from AmoCRM
- /tasks — Important Tasks: company-wide task board
- /lead-tasks — Lead Tasks: every open task grouped by its lead
- /audio-analytics — Audio Analytics: call volume, connection rate, AI call summaries
- /attendance — Attendance & Quotas: clock in/out, call logs, daily/monthly pacing
- /inbox — Inbox: notifications and mentions
- /analytics — Analytics: revenue trend and forecasting reports
- /ai-assistant — this AI Assistant's own full-page chat
- /integrations — Integrations: connect AmoCRM, Telegram bot, Google Docs/Forms, etc.
- /settings — Settings: Profile, Personalization, Notifications, Business profile, Stages, Tags, Users, Telegram bot
- /admin — Admin Panel (super_admin only): employee/role management, org structure, auto-responders, AI agents, error logs
- /platform — Platform (platform_owner only): manage every company on the platform`;

        // The admin-configured prompt (if any) sets the assistant's persona/tone
        // as an intro layer; the navigation guide and tool-use rules below always
        // apply underneath it, since removing them would break the assistant's
        // ability to point users at real pages or actually act on their behalf.
        const introPrompt =
          chatAgent?.system_prompt?.trim() ||
          "You are the AI assistant built into SalesOS Elite, a CRM for sales teams. Be concise and practical. Reply in the same language the user writes in.";

        let systemPrompt =
          introPrompt +
          "\n\nWhen the user asks where to find something or how to do something in the app, name the exact page and, when useful, give the numbered steps to get there — for example: '1. Open Sozlamalar (Settings) in the sidebar. 2. Click Biznes profili. 3. Fill in the form and press Saqlash.' Always include the page's path in parentheses so it's unambiguous, e.g. (/settings). Only reference pages from this list — never invent a path that isn't here:\n" +
          NAV_GUIDE +
          "\n\nYou also have tools to actually act, not just describe: search_leads, create_my_task, add_lead_note, update_lead_stage. Use them whenever the user asks you to do something rather than just explain it (e.g. 'remind me to call Aziz tomorrow', 'add a note on the Akmal deal', 'move that lead to negotiation'). Never invent a lead_id — call search_leads first if you don't already have the right id from earlier in this conversation, and if multiple leads match, ask which one they mean instead of guessing. After a tool call succeeds, confirm plainly what you did.";
        if (profile) {
          const context = [
            profile.company_name && `Company: ${profile.company_name}`,
            profile.description && `About the business: ${profile.description}`,
            profile.competitors && `Known competitors: ${profile.competitors}`,
            profile.terminology && `Business-specific terms/jargon: ${profile.terminology}`,
            profile.tone && `Preferred tone of voice: ${profile.tone}`,
          ]
            .filter(Boolean)
            .join("\n");
          if (context) systemPrompt += `\n\nBusiness context:\n${context}`;
        }

        let ownerIds: string[] | null = null;
        if (caller?.organization_id) {
          try {
            ownerIds = await visibleOwnerIds(caller.organization_id, userId, caller.role);
            const snapshot = await loadDataSnapshot(caller.organization_id, asOf, ownerIds);
            systemPrompt += `\n\n${snapshot}`;
          } catch {
            // Snapshot is best-effort context; a failure here shouldn't block the chat.
          }
        }

        const contents: GeminiContent[] = messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));
        const functionDeclarations = TOOLS.map((t) => t.function);
        let reply = "";
        // Capped: one round to call tools, one to answer using their results is the
        // common case, but a request can chain a couple of tools (search then act).
        const MAX_TOOL_ROUNDS = 4;
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents,
                tools: [{ functionDeclarations }],
                generationConfig: { temperature: 0.4 },
              }),
            },
          );

          if (!res.ok) {
            const text = await res.text();
            return Response.json(
              { error: `Gemini error (${res.status}): ${text}` },
              { status: 502 },
            );
          }

          const json = (await res.json()) as {
            candidates?: { content?: { parts?: GeminiPart[] } }[];
          };
          const parts = json.candidates?.[0]?.content?.parts ?? [];
          if (parts.length === 0) break;

          const functionCalls = parts.filter(
            (p): p is { functionCall: { name: string; args?: Record<string, unknown> } } =>
              "functionCall" in p,
          );

          if (functionCalls.length > 0 && caller?.organization_id) {
            contents.push({ role: "model", parts });
            const responseParts: GeminiPart[] = [];
            for (const call of functionCalls) {
              const result = await executeTool(
                call.functionCall.name,
                call.functionCall.args ?? {},
                {
                  orgId: caller.organization_id,
                  callerId: userId,
                  ownerIds,
                },
              );
              responseParts.push({
                functionResponse: {
                  name: call.functionCall.name,
                  response:
                    result && typeof result === "object"
                      ? (result as Record<string, unknown>)
                      : { result },
                },
              });
            }
            contents.push({ role: "function", parts: responseParts });
            continue;
          }

          reply = parts
            .filter((p): p is { text: string } => "text" in p)
            .map((p) => p.text)
            .join("");
          break;
        }

        return Response.json({ reply });
      },
    },
  },
});
