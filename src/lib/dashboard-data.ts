import {
  Banknote,
  CalendarRange,
  Layers3,
  UserPlus,
  Trophy,
  XCircle,
  Percent,
  Gauge,
  type LucideIcon,
} from "lucide-react";

export type Kpi = {
  id: string;
  label: string;
  value: string;
  delta: number;
  comparison: string;
  tooltip: string;
  icon: LucideIcon;
  spark: number[];
};

export const KPIS: Kpi[] = [
  {
    id: "revenue-today",
    label: "Revenue today",
    value: "$48,200",
    delta: 12.4,
    comparison: "vs yesterday",
    tooltip: "Sum of all deals marked Won today across every department.",
    icon: Banknote,
    spark: [22, 28, 24, 33, 30, 41, 38, 48],
  },
  {
    id: "revenue-month",
    label: "Revenue this month",
    value: "$768,050",
    delta: 9.3,
    comparison: "vs July",
    tooltip: "Month-to-date closed revenue, net of refunds.",
    icon: CalendarRange,
    spark: [412, 468, 521, 498, 587, 641, 703, 768],
  },
  {
    id: "pipeline",
    label: "Pipeline value",
    value: "$1.04M",
    delta: 7.6,
    comparison: "128 active deals",
    tooltip: "Weighted value of all open opportunities.",
    icon: Layers3,
    spark: [680, 712, 790, 764, 851, 902, 968, 1042],
  },
  {
    id: "new-leads",
    label: "New leads today",
    value: "64",
    delta: 18.2,
    comparison: "vs daily average",
    tooltip: "Leads created today from all sources and integrations.",
    icon: UserPlus,
    spark: [38, 42, 51, 47, 55, 49, 58, 64],
  },
  {
    id: "won",
    label: "Won deals",
    value: "23",
    delta: 6.5,
    comparison: "this week",
    tooltip: "Deals moved to the Won stage in the last 7 days.",
    icon: Trophy,
    spark: [12, 15, 14, 18, 17, 20, 21, 23],
  },
  {
    id: "lost",
    label: "Lost deals",
    value: "9",
    delta: -14.3,
    comparison: "this week",
    tooltip: "Deals marked Lost. Lower is better.",
    icon: XCircle,
    spark: [16, 15, 13, 14, 12, 11, 10, 9],
  },
  {
    id: "conversion",
    label: "Conversion rate",
    value: "34.8%",
    delta: 2.1,
    comparison: "lead → won",
    tooltip: "Percentage of qualified leads that reach the Won stage.",
    icon: Percent,
    spark: [28, 29, 31, 30, 32, 33, 34, 35],
  },
  {
    id: "employee-kpi",
    label: "Employee KPI",
    value: "87 / 100",
    delta: 3.4,
    comparison: "team average",
    tooltip: "Composite score of activity, quality and quota attainment.",
    icon: Gauge,
    spark: [72, 76, 74, 79, 81, 84, 85, 87],
  },
];

export const REVENUE_RANGES = {
  Daily: [
    { label: "Mon", revenue: 31200, pipeline: 48000 },
    { label: "Tue", revenue: 38400, pipeline: 52000 },
    { label: "Wed", revenue: 29800, pipeline: 46500 },
    { label: "Thu", revenue: 44100, pipeline: 61000 },
    { label: "Fri", revenue: 48200, pipeline: 67400 },
    { label: "Sat", revenue: 19800, pipeline: 24000 },
    { label: "Sun", revenue: 12400, pipeline: 18600 },
  ],
  Weekly: [
    { label: "W31", revenue: 168000, pipeline: 242000 },
    { label: "W32", revenue: 184500, pipeline: 261000 },
    { label: "W33", revenue: 173200, pipeline: 254000 },
    { label: "W34", revenue: 201400, pipeline: 288000 },
    { label: "W35", revenue: 224950, pipeline: 312000 },
  ],
  Monthly: [
    { label: "Jan", revenue: 412000, pipeline: 680000 },
    { label: "Feb", revenue: 468000, pipeline: 712000 },
    { label: "Mar", revenue: 521000, pipeline: 790000 },
    { label: "Apr", revenue: 498000, pipeline: 764000 },
    { label: "May", revenue: 587000, pipeline: 851000 },
    { label: "Jun", revenue: 641000, pipeline: 902000 },
    { label: "Jul", revenue: 703000, pipeline: 968000 },
    { label: "Aug", revenue: 768050, pipeline: 1042000 },
  ],
  Yearly: [
    { label: "2022", revenue: 2840000, pipeline: 4210000 },
    { label: "2023", revenue: 3960000, pipeline: 5680000 },
    { label: "2024", revenue: 5120000, pipeline: 7240000 },
    { label: "2025", revenue: 6480000, pipeline: 9110000 },
    { label: "2026", revenue: 4598050, pipeline: 6820000 },
  ],
} as const;

export type RevenueRange = keyof typeof REVENUE_RANGES;

export const PIPELINE_STAGES = [
  { stage: "Lead", value: 3120000, deals: 1240, avgDays: 1.2 },
  { stage: "Qualified", value: 2260000, deals: 742, avgDays: 3.4 },
  { stage: "Negotiation", value: 1580000, deals: 418, avgDays: 5.1 },
  { stage: "Proposal", value: 1041000, deals: 236, avgDays: 7.8 },
  { stage: "Won", value: 684000, deals: 128, avgDays: 2.0 },
  { stage: "Lost", value: 402500, deals: 71, avgDays: 4.4 },
];

export const FUNNEL_FLOW = [
  { stage: "Lead", count: 1240, conversion: 100 },
  { stage: "Qualified", count: 742, conversion: 59.8 },
  { stage: "Negotiation", count: 418, conversion: 33.7 },
  { stage: "Proposal", count: 236, conversion: 19.0 },
  { stage: "Won", count: 128, conversion: 10.3 },
  { stage: "Lost", count: 71, conversion: 5.7 },
];

export type BoardTask = {
  id: string;
  title: string;
  meta: string;
  priority: "Urgent" | "High" | "Normal" | "Low";
  bucket: "Today" | "Overdue" | "Upcoming";
};

export const DASHBOARD_TASKS: BoardTask[] = [
  { id: "T-1041", title: "Prepare Q3 enterprise renewal pack", meta: "Aizhan S. · 14:00", priority: "Urgent", bucket: "Today" },
  { id: "T-1039", title: "Send revised proposal to Halyk Fintech", meta: "Daniyar O. · due 2 days ago", priority: "Urgent", bucket: "Overdue" },
  { id: "T-1044", title: "Call quality audit — SMB team", meta: "Timur Y. · 16:30", priority: "High", bucket: "Today" },
  { id: "T-1046", title: "Follow up with Tengri Retail", meta: "Madina K. · yesterday", priority: "High", bucket: "Overdue" },
  { id: "T-1050", title: "Quarterly forecast review", meta: "Leadership · Thu", priority: "Normal", bucket: "Upcoming" },
  { id: "T-1052", title: "Onboard 2 new SDRs", meta: "Alina B. · Fri", priority: "Low", bucket: "Upcoming" },
];

export type LeadTask = {
  id: string;
  title: string;
  lead: string;
  owner: string;
  group: "Today" | "Tomorrow" | "This Week";
};

export const DASHBOARD_LEAD_TASKS: LeadTask[] = [
  { id: "LT-1", title: "Contract review call", lead: "Kazpost Digital", owner: "Aizhan S.", group: "Today" },
  { id: "LT-2", title: "Send SOC2 documentation", lead: "Halyk Fintech", owner: "Daniyar O.", group: "Today" },
  { id: "LT-3", title: "Technical scoping session", lead: "Astana Logistics", owner: "Madina K.", group: "Tomorrow" },
  { id: "LT-4", title: "Pricing re-negotiation", lead: "Tengri Retail", owner: "Timur Y.", group: "Tomorrow" },
  { id: "LT-5", title: "Renewal kickoff", lead: "Silk Road Cargo", owner: "Alina B.", group: "This Week" },
  { id: "LT-6", title: "Win-back sequence", lead: "Almaty Medtech", owner: "Ruslan I.", group: "This Week" },
];

export const ACTIVITY_TIMELINE = [
  { id: "A-1", who: "Aizhan Serikova", what: "moved lead Kazpost Digital", from: "Proposal", to: "Negotiation", when: "12 min ago" },
  { id: "A-2", who: "Automation", what: "updated deal value for Halyk Fintech", from: "$54,000", to: "$62,500", when: "48 min ago" },
  { id: "A-3", who: "Daniyar Omarov", what: "changed task priority", from: "Normal", to: "Urgent", when: "1h ago" },
  { id: "A-4", who: "Madina Kaparova", what: "reassigned Astana Logistics", from: "Ruslan I.", to: "Madina K.", when: "3h ago" },
  { id: "A-5", who: "AI Copilot", what: "flagged call C-2193", from: "Unreviewed", to: "Needs coaching", when: "4h ago" },
];

export const AI_INSIGHTS = [
  { id: "I-1", tone: "danger" as const, title: "Proposal stage slowed by 31%", body: "Average time in Proposal grew from 5.9 to 7.8 days. 42 deals worth $312k are affected." },
  { id: "I-2", tone: "success" as const, title: "Aizhan has the highest conversion", body: "41% win rate — 6 points above team average. Consider sharing her discovery script." },
  { id: "I-3", tone: "warning" as const, title: "Response time increased", body: "First response to new leads went from 22 to 38 minutes this week, mostly in SMB." },
  { id: "I-4", tone: "info" as const, title: "Recommended: call Lead #245", body: "Silk Road Cargo opened the proposal 5 times in 24h but has no scheduled follow-up." },
];
