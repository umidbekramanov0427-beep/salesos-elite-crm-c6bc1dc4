import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "list_deals",
  title: "List deals",
  description: "List deals in the SalesOS Elite pipeline with value, probability, stage and owner.",
  inputSchema: {
    stage: z
      .string()
      .optional()
      .describe("Deal stage name filter, e.g. Negotiation, Proposal, Won."),
    owner: z.string().optional().describe("Deal owner full name."),
    min_value: z.number().optional().describe("Only deals worth at least this amount."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ stage, owner, min_value }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("deals")
      .select("id, name, value, probability, stage_id, owner_id, status")
      .order("updated_at", { ascending: false })
      .limit(500);
    if (typeof min_value === "number") query = query.gte("value", min_value);
    const { data: deals, error } = await query;
    if (error) throw new Error(error.message);

    const ownerIds = [
      ...new Set((deals ?? []).map((d) => d.owner_id).filter((v): v is string => !!v)),
    ];
    const [{ data: stages }, { data: owners }] = await Promise.all([
      supabaseAdmin.from("pipeline_stages").select("id, name"),
      ownerIds.length
        ? supabaseAdmin.from("profiles").select("id, full_name, email").in("id", ownerIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string; email: string }[] }),
    ]);
    const stageById = new Map((stages ?? []).map((s) => [s.id, s.name]));
    const ownerById = new Map((owners ?? []).map((o) => [o.id, o.full_name || o.email]));

    const rows = (deals ?? [])
      .map((d) => ({
        id: d.id,
        name: d.name,
        value: d.value,
        probability: d.probability,
        stage: (d.stage_id && stageById.get(d.stage_id)) || "New Lead",
        status: d.status,
        owner: (d.owner_id && ownerById.get(d.owner_id)) || "Unassigned",
      }))
      .filter((d) => {
        if (stage && d.stage.toLowerCase() !== stage.toLowerCase()) return false;
        if (owner && d.owner.toLowerCase() !== owner.toLowerCase()) return false;
        return true;
      });

    const weighted = rows.reduce((sum, d) => sum + (d.value * d.probability) / 100, 0);
    const payload = {
      count: rows.length,
      totalValue: rows.reduce((s, d) => s + d.value, 0),
      weightedValue: Math.round(weighted),
      deals: rows,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
