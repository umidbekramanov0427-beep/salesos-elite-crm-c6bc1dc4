import { defineTool } from "@lovable.dev/mcp-js";
import { requireToolOrgId } from "./org-scope";

export default defineTool({
  name: "pipeline_summary",
  title: "Pipeline summary",
  description:
    "Summarize the sales pipeline: lead and deal counts, total and weighted value per stage.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    const orgId = await requireToolOrgId(ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [
      { data: stages, error: stagesError },
      { data: leads, error: leadsError },
      { data: deals, error: dealsError },
    ] = await Promise.all([
      supabaseAdmin
        .from("pipeline_stages")
        .select("id, name")
        .eq("organization_id", orgId)
        .order("position", { ascending: true }),
      supabaseAdmin.from("leads").select("stage_id, expected_revenue").eq("organization_id", orgId),
      supabaseAdmin
        .from("deals")
        .select("stage_id, value, probability")
        .eq("organization_id", orgId),
    ]);
    if (stagesError) throw new Error(stagesError.message);
    if (leadsError) throw new Error(leadsError.message);
    if (dealsError) throw new Error(dealsError.message);

    const stageRows = stages ?? [];
    const leadRows = leads ?? [];
    const dealRows = deals ?? [];

    const summary = stageRows.map((s) => {
      const stageLeads = leadRows.filter((l) => l.stage_id === s.id);
      const stageDeals = dealRows.filter((d) => d.stage_id === s.id);
      return {
        stage: s.name,
        leads: stageLeads.length,
        leadValue: stageLeads.reduce((sum, l) => sum + l.expected_revenue, 0),
        deals: stageDeals.length,
        dealValue: stageDeals.reduce((sum, d) => sum + d.value, 0),
        weightedDealValue: Math.round(
          stageDeals.reduce((sum, d) => sum + (d.value * d.probability) / 100, 0),
        ),
      };
    });

    const payload = {
      stages: summary,
      totals: {
        leads: leadRows.length,
        deals: dealRows.length,
        dealValue: dealRows.reduce((s, d) => s + d.value, 0),
      },
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
