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
          apiKey = requireEnv("DEEPSEEK_API_KEY");
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Missing DEEPSEEK_API_KEY" },
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

        let systemPrompt =
          "You are the AI assistant built into SalesOS Elite, a CRM for sales teams. Be concise and practical. Reply in the same language the user writes in.\n\n" +
          "When the user asks where to find something or how to do something in the app, name the exact page and, when useful, give the numbered steps to get there — for example: '1. Open Sozlamalar (Settings) in the sidebar. 2. Click Biznes profili. 3. Fill in the form and press Saqlash.' Always include the page's path in parentheses so it's unambiguous, e.g. (/settings). Only reference pages from this list — never invent a path that isn't here:\n" +
          NAV_GUIDE;
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

        if (caller?.organization_id) {
          try {
            const ownerIds = await visibleOwnerIds(caller.organization_id, userId, caller.role);
            const snapshot = await loadDataSnapshot(caller.organization_id, asOf, ownerIds);
            systemPrompt += `\n\n${snapshot}`;
          } catch {
            // Snapshot is best-effort context; a failure here shouldn't block the chat.
          }
        }

        const res = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: "deepseek-chat",
            temperature: 0.4,
            messages: [{ role: "system", content: systemPrompt }, ...messages],
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          return Response.json(
            { error: `DeepSeek error (${res.status}): ${text}` },
            { status: 502 },
          );
        }

        const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const reply = json.choices?.[0]?.message?.content ?? "";
        return Response.json({ reply });
      },
    },
  },
});
