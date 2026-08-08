import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { AI_SUGGESTIONS, CRM_LEADS, LEAD_TASKS_DETAIL, LEAD_TIMELINE } from "@/lib/crm-data";

export default defineTool({
  name: "get_lead",
  title: "Get lead detail",
  description:
    "Get the full CRM workspace record for one lead: contact details, deal context, recent activity timeline, open tasks and AI suggestions.",
  inputSchema: {
    lead_id: z.string().min(1).describe("Lead id, e.g. L-8842."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ lead_id }) => {
    const id = lead_id.trim().toUpperCase();
    const lead = CRM_LEADS.find((l) => l.id.toUpperCase() === id);
    if (!lead) throw new ToolError(`No lead found with id "${lead_id}".`);

    const payload = {
      lead,
      timeline: LEAD_TIMELINE,
      tasks: LEAD_TASKS_DETAIL,
      aiSuggestions: AI_SUGGESTIONS,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
