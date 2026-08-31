import { defineTool } from "@lovable.dev/mcp-js";
import { requireToolOrgId } from "./org-scope";

export default defineTool({
  name: "pipeline_summary",
  title: "Pipeline summary",
  description: "Summarize the sales pipeline: lead counts and total expected value per stage.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    const orgId = await requireToolOrgId(ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: stages, error: stagesError }, { data: leads, error: leadsError }] =
      await Promise.all([
        supabaseAdmin
          .from("pipeline_stages")
          .select("id, name")
          .eq("organization_id", orgId)
          .order("position", { ascending: true }),
        supabaseAdmin
          .from("leads")
          .select("stage_id, expected_revenue")
          .eq("organization_id", orgId),
      ]);
    if (stagesError) throw new Error(stagesError.message);
    if (leadsError) throw new Error(leadsError.message);

    const stageRows = stages ?? [];
    const leadRows = leads ?? [];

    const summary = stageRows.map((s) => {
      const stageLeads = leadRows.filter((l) => l.stage_id === s.id);
      return {
        stage: s.name,
        leads: stageLeads.length,
        leadValue: stageLeads.reduce((sum, l) => sum + l.expected_revenue, 0),
      };
    });

    const payload = {
      stages: summary,
      totals: {
        leads: leadRows.length,
        leadValue: leadRows.reduce((s, l) => s + l.expected_revenue, 0),
      },
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
