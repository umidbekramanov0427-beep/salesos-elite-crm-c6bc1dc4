import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { DEALS } from "@/lib/crm-data";

export default defineTool({
  name: "list_deals",
  title: "List deals",
  description: "List deals in the SalesOS Elite pipeline with value, probability, stage and owner.",
  inputSchema: {
    stage: z.string().optional().describe("Deal stage filter, e.g. Negotiation, Proposal, Won."),
    owner: z.string().optional().describe("Deal owner full name."),
    min_value: z.number().optional().describe("Only deals worth at least this amount."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ stage, owner, min_value }) => {
    const rows = DEALS.filter((d) => {
      if (stage && d.stage.toLowerCase() !== stage.toLowerCase()) return false;
      if (owner && d.owner.toLowerCase() !== owner.toLowerCase()) return false;
      if (typeof min_value === "number" && d.value < min_value) return false;
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
