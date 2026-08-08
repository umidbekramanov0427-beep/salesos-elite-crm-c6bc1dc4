import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { CRM_LEADS, PIPELINE_STAGES } from "@/lib/crm-data";

export default defineTool({
  name: "list_leads",
  title: "List leads",
  description:
    "List CRM leads from SalesOS Elite, optionally filtered by stage, temperature, owner or a free-text search over name/company.",
  inputSchema: {
    search: z.string().optional().describe("Free-text match on lead name, company or email."),
    stage: z.enum(PIPELINE_STAGES.map((s) => s.name) as [string, ...string[]]).optional().describe("Pipeline stage filter."),
    temperature: z.enum(["Hot", "Warm", "Cold"]).optional(),
    owner: z.string().optional().describe("Lead owner full name."),
    limit: z.number().int().min(1).max(100).optional().describe("Max rows to return (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ search, stage, temperature, owner, limit }) => {
    const q = search?.trim().toLowerCase();
    const rows = CRM_LEADS.filter((l) => {
      if (stage && l.stage !== stage) return false;
      if (temperature && l.temperature !== temperature) return false;
      if (owner && l.owner.toLowerCase() !== owner.toLowerCase()) return false;
      if (
        q &&
        !`${l.name} ${l.company} ${l.email}`.toLowerCase().includes(q)
      )
        return false;
      return true;
    })
      .slice(0, limit ?? 25)
      .map((l) => ({
        id: l.id,
        name: l.name,
        company: l.company,
        position: l.position,
        email: l.email,
        phone: l.phone,
        stage: l.stage,
        temperature: l.temperature,
        priority: l.priority,
        score: l.score,
        expectedRevenue: l.expectedRevenue,
        owner: l.owner,
        nextFollowUp: l.nextFollowUp,
      }));

    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { count: rows.length, leads: rows },
    };
  },
});
