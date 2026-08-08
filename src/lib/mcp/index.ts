import { defineMcp } from "@lovable.dev/mcp-js";
import listLeads from "./tools/list-leads";
import getLead from "./tools/get-lead";
import listDeals from "./tools/list-deals";
import pipelineSummary from "./tools/pipeline-summary";
import leaderboardRanking from "./tools/leaderboard";

export default defineMcp({
  name: "salesos-elite-crm",
  title: "SalesOS Elite CRM",
  version: "0.1.0",
  instructions:
    "Read-only tools for the SalesOS Elite sales operating system. Use `list_leads` and `get_lead` for CRM lead research, `list_deals` and `pipeline_summary` for pipeline value analysis, and `leaderboard_ranking` for sales-team performance rankings and insights.",
  tools: [listLeads, getLead, listDeals, pipelineSummary, leaderboardRanking],
});
