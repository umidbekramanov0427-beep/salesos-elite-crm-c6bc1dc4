import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "get_lead",
  title: "Get lead detail",
  description:
    "Get the full CRM workspace record for one lead: contact details, deal context, recent activity timeline and open tasks.",
  inputSchema: {
    lead_id: z.string().min(1).describe("Lead id (UUID)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ lead_id }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: lead, error } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("id", lead_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!lead) throw new ToolError(`No lead found with id "${lead_id}".`);

    const [
      { data: contact },
      { data: owner },
      { data: stage },
      { data: timeline },
      { data: tasks },
    ] = await Promise.all([
      lead.contact_id
        ? supabaseAdmin.from("contacts").select("*").eq("id", lead.contact_id).maybeSingle()
        : Promise.resolve({ data: null }),
      lead.owner_id
        ? supabaseAdmin
            .from("profiles")
            .select("full_name, email")
            .eq("id", lead.owner_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      lead.stage_id
        ? supabaseAdmin.from("pipeline_stages").select("name").eq("id", lead.stage_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabaseAdmin
        .from("lead_activities")
        .select("type, content, created_at")
        .eq("lead_id", lead_id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("tasks")
        .select("title, status, priority, due_date")
        .eq("lead_id", lead_id)
        .order("due_date", { ascending: true }),
    ]);

    const payload = {
      lead: {
        id: lead.id,
        name: lead.name,
        company: lead.company_name,
        position: contact?.position ?? "",
        email: contact?.email ?? "",
        phone: contact?.phone ?? "",
        stage: stage?.name ?? "New Lead",
        temperature: lead.temperature,
        priority: lead.priority,
        score: lead.score,
        expectedRevenue: lead.expected_revenue,
        owner: owner?.full_name || owner?.email || "Unassigned",
        source: lead.source,
        nextFollowUp: lead.next_follow_up,
        tags: lead.tags,
      },
      timeline: timeline ?? [],
      tasks: tasks ?? [],
    };

    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
