// Real-time leaderboard engine.
// Deterministic seeded roster + incremental tick simulation so the UI can
// update every 3s without refetching or re-rendering the whole page.

export type LeaderboardMetricKey =
  | "revenue"
  | "dealsClosed"
  | "calls"
  | "meetings"
  | "tasks"
  | "conversion"
  | "rating"
  | "responseTime"
  | "attendance"
  | "overall";

export type MetricDef = {
  key: LeaderboardMetricKey;
  label: string;
  /** lower value = better rank */
  invert?: boolean;
  format: (n: number) => string;
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const METRICS: MetricDef[] = [
  { key: "overall", label: "Overall score", format: (n) => `${n.toFixed(1)} pts` },
  { key: "revenue", label: "Revenue", format: (n) => money.format(n) },
  { key: "dealsClosed", label: "Deals closed", format: (n) => `${Math.round(n)}` },
  { key: "calls", label: "Calls", format: (n) => `${Math.round(n)}` },
  { key: "meetings", label: "Meetings", format: (n) => `${Math.round(n)}` },
  { key: "tasks", label: "Tasks completed", format: (n) => `${Math.round(n)}` },
  { key: "conversion", label: "Conversion", format: (n) => `${n.toFixed(1)}%` },
  { key: "rating", label: "Customer rating", format: (n) => `${n.toFixed(2)} / 5` },
  { key: "responseTime", label: "Response time", invert: true, format: (n) => `${Math.round(n)} min` },
  { key: "attendance", label: "Attendance", format: (n) => `${n.toFixed(1)}%` },
];

export const PERIODS = [
  "Today",
  "Yesterday",
  "This Week",
  "This Month",
  "Quarter",
  "Year",
  "Custom",
] as const;
export type Period = (typeof PERIODS)[number];

/** Period weight applied to cumulative counters (mock scaling). */
const PERIOD_SCALE: Record<Period, number> = {
  Today: 1,
  Yesterday: 0.92,
  "This Week": 5.4,
  "This Month": 21,
  Quarter: 62,
  Year: 240,
  Custom: 12,
};

export const DEPARTMENTS = ["Enterprise", "Mid-Market", "SMB", "Call Center", "Partnerships"] as const;
export const TEAMS = ["Alpha", "Bravo", "Delta", "Nova"] as const;
export const BRANCHES = ["Tashkent HQ", "Almaty", "Astana", "Bishkek", "Remote"] as const;

export type Employee = {
  id: string;
  name: string;
  initials: string;
  avatarHue: number;
  department: string;
  team: string;
  branch: string;
  position: string;
  managerId: string | null;
  // live metrics (per-day base values)
  revenue: number;
  dealsClosed: number;
  calls: number;
  meetings: number;
  tasks: number;
  followUps: number;
  conversion: number;
  rating: number;
  responseTime: number;
  attendance: number;
  leadScore: number;
  dailyTarget: number;
  monthlyTarget: number;
  monthlyRevenue: number;
};

/* ------------------------------------------------------------------ */
/* Bonus formula — admin configurable, never hardcoded at call sites.  */
/* ------------------------------------------------------------------ */

export type BonusRule = { atPercent: number; bonusPercent: number };

export type BonusConfig = {
  /** ordered ascending by atPercent; highest matching tier wins */
  tiers: BonusRule[];
  /** extra bonus percent per full percentage point above the top tier */
  perPointAboveTop: number;
  cap: number;
};

export const DEFAULT_BONUS_CONFIG: BonusConfig = {
  tiers: [
    { atPercent: 80, bonusPercent: 1 },
    { atPercent: 90, bonusPercent: 2.5 },
    { atPercent: 100, bonusPercent: 5 },
    { atPercent: 120, bonusPercent: 8 },
  ],
  perPointAboveTop: 0.1,
  cap: 15,
};

export function calcBonus(attainmentPercent: number, config: BonusConfig): number {
  const tiers = [...config.tiers].sort((a, b) => a.atPercent - b.atPercent);
  let bonus = 0;
  let top = tiers[0]?.atPercent ?? 100;
  for (const t of tiers) {
    if (attainmentPercent >= t.atPercent) {
      bonus = t.bonusPercent;
      top = t.atPercent;
    }
  }
  const highest = tiers[tiers.length - 1];
  if (highest && attainmentPercent > highest.atPercent) {
    bonus = highest.bonusPercent + (attainmentPercent - highest.atPercent) * config.perPointAboveTop;
    top = highest.atPercent;
  }
  void top;
  return Math.min(config.cap, Math.round(bonus * 10) / 10);
}

/* ------------------------------------------------------------------ */
/* Roster generation                                                   */
/* ------------------------------------------------------------------ */

const FIRST = [
  "Aziz", "Dilshod", "Aizhan", "Daniyar", "Madina", "Timur", "Alina", "Ruslan", "Nodira", "Jasur",
  "Kamila", "Bekzod", "Zarina", "Sardor", "Gulnara", "Otabek", "Malika", "Farrukh", "Nigora", "Shokhrukh",
  "Elmira", "Islom", "Sevara", "Rustam", "Dilnoza", "Akmal", "Lola", "Javohir", "Umida", "Bakhtiyor",
];
const LAST = [
  "Karimov", "Rakhimov", "Serikova", "Omarov", "Kaparova", "Yesenov", "Bekova", "Iskakov", "Yusupova", "Tashkentov",
  "Nazarova", "Alimov", "Sultanova", "Ergashev", "Mirzaeva", "Kholmatov", "Saidova", "Abdullaev", "Turaeva", "Nurmatov",
];
const POSITIONS = [
  "Senior AE", "Account Executive", "SDR Lead", "SDR", "Call Operator", "Team Leader", "Partnership Manager",
];

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateRoster(count = 240): Employee[] {
  const rnd = mulberry32(20260804);
  const out: Employee[] = [];
  for (let i = 0; i < count; i++) {
    const first = FIRST[Math.floor(rnd() * FIRST.length)]!;
    const last = LAST[Math.floor(rnd() * LAST.length)]!;
    const department = DEPARTMENTS[Math.floor(rnd() * DEPARTMENTS.length)]!;
    const dailyTarget = 2000 + Math.round(rnd() * 4000);
    const monthlyTarget = dailyTarget * 21;
    out.push({
      id: `E-${(i + 1).toString().padStart(4, "0")}`,
      name: `${first} ${last}`,
      initials: `${first[0]}${last[0]}`,
      avatarHue: Math.floor(rnd() * 360),
      department,
      team: TEAMS[Math.floor(rnd() * TEAMS.length)]!,
      branch: BRANCHES[Math.floor(rnd() * BRANCHES.length)]!,
      position: POSITIONS[Math.floor(rnd() * POSITIONS.length)]!,
      managerId: null,
      revenue: Math.round(600 + rnd() * 7200),
      dealsClosed: Math.round(rnd() * 9),
      calls: Math.round(8 + rnd() * 60),
      meetings: Math.round(rnd() * 8),
      tasks: Math.round(rnd() * 14),
      followUps: Math.round(rnd() * 12),
      conversion: 12 + rnd() * 38,
      rating: 3.4 + rnd() * 1.6,
      responseTime: 4 + rnd() * 44,
      attendance: 88 + rnd() * 12,
      leadScore: Math.round(40 + rnd() * 60),
      dailyTarget,
      monthlyTarget,
      monthlyRevenue: Math.round(monthlyTarget * (0.45 + rnd() * 0.85)),
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Tick — mutate a small random subset each 3s (delta-only updates)    */
/* ------------------------------------------------------------------ */

let tickSeed = 1;

export function tickRoster(roster: Employee[]): { next: Employee[]; changed: Set<string> } {
  const rnd = mulberry32((tickSeed = (tickSeed * 1664525 + 1013904223) >>> 0));
  const changed = new Set<string>();
  const movers = Math.max(4, Math.round(roster.length * 0.06));
  const next = roster.slice();

  for (let i = 0; i < movers; i++) {
    const idx = Math.floor(rnd() * next.length);
    const e = next[idx];
    if (!e) continue;
    const gain = Math.round(rnd() * 2600);
    const deals = rnd() > 0.72 ? 1 : 0;
    next[idx] = {
      ...e,
      revenue: e.revenue + gain,
      monthlyRevenue: e.monthlyRevenue + gain,
      dealsClosed: e.dealsClosed + deals,
      calls: e.calls + (rnd() > 0.5 ? 1 : 0),
      meetings: e.meetings + (rnd() > 0.85 ? 1 : 0),
      tasks: e.tasks + (rnd() > 0.6 ? 1 : 0),
      followUps: e.followUps + (rnd() > 0.7 ? 1 : 0),
      conversion: clamp(e.conversion + (rnd() - 0.45) * 1.6, 4, 78),
      rating: clamp(e.rating + (rnd() - 0.5) * 0.06, 2.5, 5),
      responseTime: clamp(e.responseTime + (rnd() - 0.55) * 2.4, 2, 90),
      attendance: clamp(e.attendance + (rnd() - 0.5) * 0.4, 70, 100),
      leadScore: Math.round(clamp(e.leadScore + (rnd() - 0.5) * 4, 10, 100)),
    };
    changed.add(e.id);
  }
  return { next, changed };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/* ------------------------------------------------------------------ */
/* Derived rows                                                        */
/* ------------------------------------------------------------------ */

export type LeaderboardRow = {
  employee: Employee;
  rank: number;
  metricValue: number;
  metricLabel: string;
  revenue: number;
  dailyKpi: number;
  monthlyKpi: number;
  bonus: number;
  targetCompletion: number;
  overall: number;
};

export type Filters = {
  period: Period;
  metric: LeaderboardMetricKey;
  department: string;
  team: string;
  branch: string;
  scope: "company" | "team";
  scopeTeam: string;
  search: string;
};

export function overallScore(e: Employee): number {
  const attain = (e.revenue / e.dailyTarget) * 100;
  return (
    attain * 0.4 +
    e.conversion * 0.8 +
    e.rating * 4 +
    e.attendance * 0.15 +
    e.dealsClosed * 1.2 +
    Math.max(0, 40 - e.responseTime) * 0.3
  );
}

function metricValue(e: Employee, key: LeaderboardMetricKey, scale: number): number {
  switch (key) {
    case "revenue":
      return e.revenue * scale;
    case "dealsClosed":
      return e.dealsClosed * scale;
    case "calls":
      return e.calls * scale;
    case "meetings":
      return e.meetings * scale;
    case "tasks":
      return e.tasks * scale;
    case "conversion":
      return e.conversion;
    case "rating":
      return e.rating;
    case "responseTime":
      return e.responseTime;
    case "attendance":
      return e.attendance;
    case "overall":
    default:
      return overallScore(e);
  }
}

export function buildRows(
  roster: Employee[],
  filters: Filters,
  bonusConfig: BonusConfig,
): LeaderboardRow[] {
  const scale = PERIOD_SCALE[filters.period];
  const def = METRICS.find((m) => m.key === filters.metric) ?? METRICS[0]!;
  const q = filters.search.trim().toLowerCase();

  const filtered = roster.filter((e) => {
    if (filters.department !== "All" && e.department !== filters.department) return false;
    if (filters.team !== "All" && e.team !== filters.team) return false;
    if (filters.branch !== "All" && e.branch !== filters.branch) return false;
    if (filters.scope === "team" && e.team !== filters.scopeTeam) return false;
    if (q && !e.name.toLowerCase().includes(q) && !e.department.toLowerCase().includes(q)) return false;
    return true;
  });

  const rows = filtered.map((e) => {
    const value = metricValue(e, filters.metric, scale);
    const monthlyKpi = (e.monthlyRevenue / e.monthlyTarget) * 100;
    return {
      employee: e,
      rank: 0,
      metricValue: value,
      metricLabel: def.format(value),
      revenue: e.revenue * scale,
      dailyKpi: (e.revenue / e.dailyTarget) * 100,
      monthlyKpi,
      bonus: calcBonus(monthlyKpi, bonusConfig),
      targetCompletion: monthlyKpi,
      overall: overallScore(e),
    };
  });

  rows.sort((a, b) => (def.invert ? a.metricValue - b.metricValue : b.metricValue - a.metricValue));
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

/* ------------------------------------------------------------------ */
/* AI insights + department/branch rollups                             */
/* ------------------------------------------------------------------ */

export function rollup(rows: LeaderboardRow[], key: "department" | "branch") {
  const map = new Map<string, { name: string; revenue: number; people: number; kpi: number }>();
  for (const r of rows) {
    const name = r.employee[key];
    const cur = map.get(name) ?? { name, revenue: 0, people: 0, kpi: 0 };
    cur.revenue += r.revenue;
    cur.people += 1;
    cur.kpi += r.monthlyKpi;
    map.set(name, cur);
  }
  return [...map.values()]
    .map((d) => ({ ...d, kpi: d.kpi / Math.max(1, d.people) }))
    .sort((a, b) => b.revenue - a.revenue);
}

export type Insight = { id: string; tone: "success" | "warning" | "danger" | "info"; text: string };

export function buildInsights(rows: LeaderboardRow[]): Insight[] {
  if (rows.length === 0) return [];
  const out: Insight[] = [];
  const top = rows[0]!;
  out.push({
    id: "top",
    tone: "success",
    text: `${top.employee.name} leads the board at ${top.metricLabel} with ${top.monthlyKpi.toFixed(0)}% of monthly target.`,
  });

  const atTarget = rows.filter((r) => r.monthlyKpi >= 100).length;
  out.push({
    id: "target",
    tone: atTarget > 0 ? "success" : "warning",
    text: `${atTarget} employee${atTarget === 1 ? "" : "s"} reached the monthly target and unlocked a bonus.`,
  });

  const weakest = rows.reduce((a, b) => (a.employee.conversion < b.employee.conversion ? a : b));
  out.push({
    id: "conv",
    tone: "danger",
    text: `${weakest.employee.name}'s conversion is ${weakest.employee.conversion.toFixed(1)}% — the lowest in the current view.`,
  });

  const depts = rollup(rows, "department");
  if (depts.length >= 2) {
    out.push({
      id: "dept",
      tone: "info",
      text: `${depts[0]!.name} is outperforming ${depts[depts.length - 1]!.name} by ${Math.round(
        ((depts[0]!.revenue - depts[depts.length - 1]!.revenue) / Math.max(1, depts[depts.length - 1]!.revenue)) * 100,
      )}% in revenue.`,
    });
  }
  return out;
}
