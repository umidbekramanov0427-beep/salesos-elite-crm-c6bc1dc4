import { defineTool } from "@lovable.dev/mcp-js";
import { CRM_LEADS, DEALS, PIPELINE_STAGES } from "@/lib/crm-data";

export default defineTool({
  name: "pipeline_summary",
  title: "Pipeline summary",
  description:
    "Summarize the sales pipeline: lead and deal counts, total and weighted value per stage.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const stages = PIPELINE_STAGES.map((stage) => {
      const leads = CRM_LEADS.filter((l) => l.stage === stage);
      const deals = DEALS.filter((d) => d.stage === stage);
      return {
        stage,
        leads: leads.length,
        leadValue: leads.reduce((s, l) => s + l.expectedRevenue, 0),
        deals: deals.length,
        dealValue: deals.reduce((s, d) => s + d.value, 0),
        weightedDealValue: Math.round(
          deals.reduce((s, d) => s + (d.value * d.probability) / 100, 0),
        ),
      };
    });
    const payload = {
      stages,
      totals: {
        leads: CRM_LEADS.length,
        deals: DEALS.length,
        dealValue: DEALS.reduce((s, d) => s + d.value, 0),
      },
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
