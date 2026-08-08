import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  DEFAULT_BONUS_CONFIG,
  buildInsights,
  buildRows,
  generateRoster,
  type Filters,
  type LeaderboardMetricKey,
} from "@/lib/leaderboard-engine";

const METRIC_KEYS = [
  "overall",
  "revenue",
  "dealsClosed",
  "calls",
  "meetings",
  "tasks",
  "conversion",
  "rating",
  "responseTime",
  "attendance",
] as const;

export default defineTool({
  name: "leaderboard_ranking",
  title: "Sales leaderboard",
  description:
    "Get the current SalesOS Elite sales leaderboard ranking for a metric and period, with AI-style performance insights.",
  inputSchema: {
    metric: z.enum(METRIC_KEYS).optional().describe("Ranking metric (default overall)."),
    period: z.enum(["Today", "Week", "Month", "Quarter", "Year"]).optional(),
    department: z.string().optional().describe("Department filter, e.g. Enterprise, SMB."),
    branch: z.string().optional().describe("Branch filter, e.g. Tashkent HQ, Almaty."),
    limit: z.number().int().min(1).max(50).optional().describe("How many ranks to return (default 10)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: ({ metric, period, department, branch, limit }) => {
    const filters: Filters = {
      period: (period ?? "Today") as Filters["period"],
      metric: (metric ?? "overall") as LeaderboardMetricKey,
      department: department ?? "All",
      team: "All",
      branch: branch ?? "All",
      scope: "company",
      scopeTeam: "Alpha",
      search: "",
    };

    const rows = buildRows(generateRoster(), filters, DEFAULT_BONUS_CONFIG);
    const top = rows.slice(0, limit ?? 10).map((r) => ({
      rank: r.rank,
      name: r.employee.name,
      department: r.employee.department,
      team: r.employee.team,
      branch: r.employee.branch,
      metric: r.metricLabel,
      revenue: Math.round(r.revenue),
      targetCompletion: Number(r.targetCompletion.toFixed(1)),
      bonus: Math.round(r.bonus),
    }));

    const payload = {
      filters: { metric: filters.metric, period: filters.period, department: filters.department, branch: filters.branch },
      totalEmployees: rows.length,
      ranking: top,
      insights: buildInsights(rows).map((i) => `${i.tone}: ${i.text}`),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
