import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, Building2, Radio, Sparkles, Users } from "lucide-react";
import { PageHeader, SectionCard, StatCard, Pill } from "@/components/layout/Primitives";
import { currency } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import {
  BRANCHES,
  DEPARTMENTS,
  METRICS,
  PERIODS,
  TEAMS,
  type Filters,
  type LeaderboardMetricKey,
  type Period,
  rollup,
} from "@/lib/leaderboard-engine";
import { REFRESH_MS, useLeaderboard } from "@/hooks/use-leaderboard";
import { PodiumCard } from "@/components/leaderboard/LeaderboardParts";
import { RankingBoard } from "@/components/leaderboard/RankingBoard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Live Leaderboard — SalesOS Elite CRM" },
      {
        name: "description",
        content:
          "Real-time sales leaderboard refreshing every 3 seconds: live ranking, KPI, bonus calculation, department and branch rollups.",
      },
      { property: "og:title", content: "Live Leaderboard — SalesOS Elite CRM" },
      {
        property: "og:description",
        content: "Real-time ranking, KPI, bonuses and AI insights for the whole revenue org.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Leaderboard,
});

const INITIAL: Filters = {
  period: "Today",
  metric: "overall",
  department: "All",
  team: "All",
  branch: "All",
  scope: "company",
  scopeTeam: "Alpha",
  search: "",
};

function Select({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  label: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide text-subtle">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function Leaderboard() {
  const { rows, insights, filters, patchFilters, moves, live, setLive, bonusConfig, setBonusConfig } =
    useLeaderboard(INITIAL);
  const [showExec, setShowExec] = useState(true);

  const metric = METRICS.find((m) => m.key === filters.metric) ?? METRICS[0]!;
  const totals = useMemo(() => {
    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    const atTarget = rows.filter((r) => r.monthlyKpi >= 100).length;
    const avgKpi = rows.length ? rows.reduce((s, r) => s + r.monthlyKpi, 0) / rows.length : 0;
    const bonusPool = rows.reduce((s, r) => s + (r.employee.monthlyRevenue * r.bonus) / 100, 0);
    return { revenue, atTarget, avgKpi, bonusPool };
  }, [rows]);

  const depts = useMemo(() => rollup(rows, "department"), [rows]);
  const branches = useMemo(() => rollup(rows, "branch"), [rows]);
  const bottom = useMemo(() => rows.slice(-5).reverse(), [rows]);

  return (
    <>
      <PageHeader
        title="Leaderboard"
        description={`Live ranking across ${rows.length} employees. Rankings, KPI and bonuses recalculate every ${REFRESH_MS / 1000} seconds.`}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLive((v) => !v)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border border-border px-3 py-1.5 text-xs font-medium transition-colors",
                live ? "bg-success/10 text-success" : "bg-surface text-muted-foreground",
              )}
            >
              <Radio className={cn("h-3.5 w-3.5", live && "animate-pulse")} />
              {live ? "Live · 3s" : "Paused"}
            </button>
            <Pill tone="info">{filters.scope === "company" ? "Company view" : `Team ${filters.scopeTeam}`}</Pill>
          </div>
        }
      />

      {/* Filters */}
      <SectionCard title="Filters" description="Period, leaderboard type and org scope">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Select label="Period" value={filters.period} options={PERIODS} onChange={(v) => patchFilters({ period: v as Period })} />
          <Select
            label="Leaderboard type"
            value={metric.label}
            options={METRICS.map((m) => m.label)}
            onChange={(v) => {
              const found = METRICS.find((m) => m.label === v);
              if (found) patchFilters({ metric: found.key as LeaderboardMetricKey });
            }}
          />
          <Select label="Department" value={filters.department} options={["All", ...DEPARTMENTS]} onChange={(v) => patchFilters({ department: v })} />
          <Select label="Team" value={filters.team} options={["All", ...TEAMS]} onChange={(v) => patchFilters({ team: v })} />
          <Select label="Branch" value={filters.branch} options={["All", ...BRANCHES]} onChange={(v) => patchFilters({ branch: v })} />
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-subtle">Search</span>
            <input
              value={filters.search}
              onChange={(e) => patchFilters({ search: e.target.value })}
              placeholder="Employee or department"
              className="h-9 rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <span className="text-[11px] uppercase tracking-wide text-subtle">View as</span>
          {(["company", "team"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => patchFilters({ scope: s })}
              className={cn(
                "rounded-xl border border-border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                filters.scope === s ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground",
              )}
            >
              {s === "company" ? "Admin · whole company" : "Manager · my team"}
            </button>
          ))}
          {filters.scope === "team" && (
            <Select label="Team scope" value={filters.scopeTeam} options={TEAMS} onChange={(v) => patchFilters({ scopeTeam: v })} />
          )}
          <div className="ml-auto flex items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-subtle">Bonus at 100% target</span>
              <input
                type="number"
                min={0}
                max={30}
                step={0.5}
                value={bonusConfig.tiers.find((t) => t.atPercent === 100)?.bonusPercent ?? 5}
                onChange={(e) =>
                  setBonusConfig((c) => ({
                    ...c,
                    tiers: c.tiers.map((t) => (t.atPercent === 100 ? { ...t, bonusPercent: Number(e.target.value) } : t)),
                  }))
                }
                className="h-9 w-28 rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-subtle">Per point above 120%</span>
              <input
                type="number"
                min={0}
                max={2}
                step={0.05}
                value={bonusConfig.perPointAboveTop}
                onChange={(e) => setBonusConfig((c) => ({ ...c, perPointAboveTop: Number(e.target.value) }))}
                className="h-9 w-28 rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            </label>
          </div>
        </div>
      </SectionCard>

      {/* Totals */}
      <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={`${filters.period} revenue`} value={currency(totals.revenue)} hint={`${rows.length} employees in view`} tone="mint" />
        <StatCard label="Average monthly KPI" value={`${totals.avgKpi.toFixed(1)}%`} hint="target attainment" />
        <StatCard label="Bonus qualified" value={`${totals.atTarget} of ${rows.length}`} hint="reached 100% of target" />
        <StatCard label="Projected bonus pool" value={currency(totals.bonusPool)} hint="auto-calculated from formula" />
      </div>

      {/* Podium */}
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        {rows.slice(0, 3).map((row, i) => (
          <PodiumCard
            key={row.employee.id}
            row={row}
            place={i}
            metricLabel={row.metricLabel}
            {...(moves[row.employee.id] ? { move: moves[row.employee.id]! } : {})}
          />
        ))}
      </div>

      {/* Ranking */}
      <div className="mt-6">
        <SectionCard
          title={`Live ranking — ${metric.label}`}
          description="Positions animate as employees move up or down. Virtualized for 1000+ employees."
        >
          <RankingBoard rows={rows} moves={moves} metric={metric} />
        </SectionCard>
      </div>

      {/* AI insights */}
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <SectionCard title="AI insights" description="Generated from the live leaderboard" className="xl:col-span-2">
          <ul className="grid gap-3 sm:grid-cols-2">
            {insights.map((i) => (
              <li key={i.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start gap-2">
                  <Sparkles
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      i.tone === "success" && "text-success",
                      i.tone === "warning" && "text-warning",
                      i.tone === "danger" && "text-destructive",
                      i.tone === "info" && "text-primary",
                    )}
                  />
                  <p className="text-sm leading-relaxed text-muted-foreground">{i.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Lowest performers" description="Needs coaching attention">
          <ul className="space-y-3">
            {bottom.map((r) => (
              <li key={r.employee.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{r.employee.name}</p>
                  <p className="truncate text-[11px] text-subtle">{r.employee.department} · #{r.rank}</p>
                </div>
                <span className="shrink-0 text-xs text-destructive">{r.monthlyKpi.toFixed(0)}% KPI</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      {/* Executive view */}
      <div className="mt-6">
        <SectionCard
          title="Executive view"
          description="Department and branch ranking, company KPI"
          actions={
            <button
              type="button"
              onClick={() => setShowExec((v) => !v)}
              className="rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground"
            >
              {showExec ? "Hide" : "Show"}
            </button>
          }
        >
          {showExec && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-subtle">
                  <Users className="h-3.5 w-3.5" /> Department ranking
                </p>
                <ul className="space-y-3">
                  {depts.map((d, i) => (
                    <li key={d.name} className="flex items-center gap-3 text-sm">
                      <span className="w-5 text-xs text-subtle">{i + 1}</span>
                      <span className="w-32 truncate font-medium">{d.name}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full rounded-full bg-primary transition-[width] duration-700"
                          style={{ width: `${(d.revenue / Math.max(1, depts[0]!.revenue)) * 100}%` }}
                        />
                      </div>
                      <span className="w-24 text-right tabular-nums text-muted-foreground">{currency(d.revenue)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-subtle">
                  <Building2 className="h-3.5 w-3.5" /> Branch ranking
                </p>
                <ul className="space-y-3">
                  {branches.map((b, i) => (
                    <li key={b.name} className="flex items-center gap-3 text-sm">
                      <span className="w-5 text-xs text-subtle">{i + 1}</span>
                      <span className="w-32 truncate font-medium">{b.name}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full rounded-full bg-success transition-[width] duration-700"
                          style={{ width: `${(b.revenue / Math.max(1, branches[0]!.revenue)) * 100}%` }}
                        />
                      </div>
                      <span className="w-16 text-right tabular-nums text-muted-foreground">{b.kpi.toFixed(0)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="lg:col-span-2 flex items-center gap-3 rounded-xl border border-border bg-surface p-4 text-sm">
                <Activity className="h-4 w-4 text-primary" />
                Company KPI is <strong className="mx-1">{totals.avgKpi.toFixed(1)}%</strong> of target with a projected
                bonus pool of <strong className="mx-1">{currency(totals.bonusPool)}</strong>.
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}
