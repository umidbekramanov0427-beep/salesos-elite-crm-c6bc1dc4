import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, Building2, Download, Radio, RefreshCw, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionCard, StatCard, Pill } from "@/components/layout/Primitives";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useCurrency, CURRENCIES } from "@/lib/currency";
import {
  BRANCHES,
  DEPARTMENTS,
  METRICS,
  PERIODS,
  TEAMS,
  type Filters,
  type LeaderboardMetricKey,
  type LeaderboardRow,
  type Period,
  rollup,
} from "@/lib/leaderboard-engine";
import { REFRESH_MS, useLeaderboard } from "@/hooks/use-leaderboard";
import { PodiumCard } from "@/components/leaderboard/LeaderboardParts";
import { RankingBoard } from "@/components/leaderboard/RankingBoard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  render,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  label: string;
  render?: (v: string) => string;
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
            {render ? render(o) : o}
          </option>
        ))}
      </select>
    </label>
  );
}

function toCsv(rows: LeaderboardRow[]): string {
  const header = [
    "Rank",
    "Employee",
    "Position",
    "Department",
    "Team",
    "Branch",
    "Metric value",
    "Revenue",
    "Deals closed",
    "Calls",
    "Meetings",
    "Conversion %",
    "Daily KPI %",
    "Monthly KPI %",
    "Bonus %",
    "Target completion %",
  ];
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      r.rank,
      r.employee.name,
      r.employee.position,
      r.employee.department,
      r.employee.team,
      r.employee.branch,
      r.metricLabel,
      Math.round(r.revenue),
      r.employee.dealsClosed,
      r.employee.calls,
      r.employee.meetings,
      r.employee.conversion.toFixed(1),
      r.dailyKpi.toFixed(1),
      r.monthlyKpi.toFixed(1),
      r.bonus,
      r.targetCompletion.toFixed(1),
    ]
      .map(esc)
      .join(","),
  );
  return [header.map(esc).join(","), ...lines].join("\n");
}

function Leaderboard() {
  const { t, lang } = useI18n();
  const { unit, setUnit, format } = useCurrency();
  const {
    rows,
    insights,
    filters,
    patchFilters,
    moves,
    live,
    setLive,
    bonusConfig,
    setBonusConfig,
    refresh,
  } = useLeaderboard(INITIAL);
  const [showExec, setShowExec] = useState(true);
  const [selected, setSelected] = useState<LeaderboardRow | null>(null);
  const [aiSnapshot, setAiSnapshot] = useState<{ items: typeof insights; at: number } | null>(null);

  const metric = METRICS.find((m) => m.key === filters.metric) ?? METRICS[0]!;
  const metricLabel = t(`metric.${metric.key}`);

  useEffect(() => {
    if (!aiSnapshot) setAiSnapshot({ items: insights, at: Date.now() });
  }, [insights, aiSnapshot]);

  const regenerate = useCallback(() => {
    setAiSnapshot({ items: insights, at: Date.now() });
    toast.success(t("lb.aiRegenerated"));
  }, [insights, t]);

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

  const bonusHint = useCallback(
    (r: LeaderboardRow) =>
      t("bonus.tooltip", {
        attain: `${r.monthlyKpi.toFixed(1)}%`,
        perPoint: bonusConfig.perPointAboveTop,
        cap: bonusConfig.cap,
        bonus: r.bonus,
      }),
    [t, bonusConfig],
  );

  function exportCsv() {
    const blob = new Blob([`\uFEFF${toCsv(rows)}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `salesos-leaderboard-${filters.metric}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(t("lb.exported", { count: rows.length }));
  }

  function manualRefresh() {
    refresh();
    setAiSnapshot({ items: insights, at: Date.now() });
    toast.success(t("lb.refreshed"));
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-dashed border-border bg-surface px-4 py-2.5 text-xs text-subtle">
        <Sparkles className="h-3.5 w-3.5 shrink-0" />
        Showing simulated roster data for demonstration. Call, meeting and rating tracking aren't
        wired to the database yet — every other page (CRM, Dashboard, Tasks, Inbox, Admin) uses your
        real workspace data.
      </div>
      <PageHeader
        title={t("lb.title")}
        description={t("lb.description", { count: rows.length, sec: REFRESH_MS / 1000 })}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-xl border border-border p-1">
              {CURRENCIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setUnit(c)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors",
                    unit === c
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setLive((v) => !v)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border border-border px-3 py-1.5 text-xs font-medium transition-colors",
                live ? "bg-success/10 text-success" : "bg-surface text-muted-foreground",
              )}
            >
              <Radio className={cn("h-3.5 w-3.5", live && "animate-pulse")} />
              {live ? t("lb.live") : t("lb.paused")}
            </button>
            <button
              type="button"
              onClick={manualRefresh}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t("common.refresh")}
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Download className="h-3.5 w-3.5" />
              {t("common.export")}
            </button>
            <Pill tone="info">
              {filters.scope === "company"
                ? t("lb.companyView")
                : t("lb.teamView", { team: filters.scopeTeam })}
            </Pill>
          </div>
        }
      />

      {/* Filters */}
      <SectionCard title={t("lb.filters")} description={t("lb.filtersDesc")}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Select
            label={t("lb.period")}
            value={filters.period}
            options={PERIODS}
            render={(p) => t(`period.${p}`)}
            onChange={(v) => patchFilters({ period: v as Period })}
          />
          <Select
            label={t("lb.type")}
            value={metric.key}
            options={METRICS.map((m) => m.key)}
            render={(k) => t(`metric.${k}`)}
            onChange={(v) => patchFilters({ metric: v as LeaderboardMetricKey })}
          />
          <Select
            label={t("lb.department")}
            value={filters.department}
            options={["All", ...DEPARTMENTS]}
            render={(v) => (v === "All" ? t("common.all") : v)}
            onChange={(v) => patchFilters({ department: v })}
          />
          <Select
            label={t("lb.team")}
            value={filters.team}
            options={["All", ...TEAMS]}
            render={(v) => (v === "All" ? t("common.all") : v)}
            onChange={(v) => patchFilters({ team: v })}
          />
          <Select
            label={t("lb.branch")}
            value={filters.branch}
            options={["All", ...BRANCHES]}
            render={(v) => (v === "All" ? t("common.all") : v)}
            onChange={(v) => patchFilters({ branch: v })}
          />
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-subtle">
              {t("common.search")}
            </span>
            <input
              value={filters.search}
              onChange={(e) => patchFilters({ search: e.target.value })}
              placeholder={t("lb.searchPlaceholder")}
              className="h-9 rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <span className="text-[11px] uppercase tracking-wide text-subtle">{t("lb.viewAs")}</span>
          {(["company", "team"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => patchFilters({ scope: s })}
              className={cn(
                "rounded-xl border border-border px-3 py-1.5 text-xs font-medium transition-colors",
                filters.scope === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface text-muted-foreground",
              )}
            >
              {s === "company" ? t("lb.scopeCompany") : t("lb.scopeTeam")}
            </button>
          ))}
          {filters.scope === "team" && (
            <Select
              label={t("lb.teamScope")}
              value={filters.scopeTeam}
              options={TEAMS}
              onChange={(v) => patchFilters({ scopeTeam: v })}
            />
          )}
          <div className="ml-auto flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-subtle">
                {t("lb.bonusAt100")}
              </span>
              <input
                type="number"
                min={0}
                max={30}
                step={0.5}
                value={bonusConfig.tiers.find((t2) => t2.atPercent === 100)?.bonusPercent ?? 5}
                onChange={(e) =>
                  setBonusConfig((c) => ({
                    ...c,
                    tiers: c.tiers.map((t2) =>
                      t2.atPercent === 100 ? { ...t2, bonusPercent: Number(e.target.value) } : t2,
                    ),
                  }))
                }
                className="h-9 w-28 rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-subtle">
                {t("lb.perPoint")}
              </span>
              <input
                type="number"
                min={0}
                max={2}
                step={0.05}
                value={bonusConfig.perPointAboveTop}
                onChange={(e) =>
                  setBonusConfig((c) => ({ ...c, perPointAboveTop: Number(e.target.value) }))
                }
                className="h-9 w-28 rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            </label>
          </div>
        </div>
      </SectionCard>

      {/* Totals */}
      <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("lb.revenueOfPeriod", { period: t(`period.${filters.period}`) })}
          value={format(totals.revenue)}
          hint={t("lb.employeesInView", { count: rows.length })}
          tone="mint"
        />
        <StatCard
          label={t("lb.avgKpi")}
          value={`${totals.avgKpi.toFixed(1)}%`}
          hint={t("lb.avgKpiHint")}
        />
        <StatCard
          label={t("lb.bonusQualified")}
          value={`${totals.atTarget} / ${rows.length}`}
          hint={t("lb.bonusQualifiedHint")}
        />
        <StatCard
          label={t("lb.bonusPool")}
          value={format(totals.bonusPool)}
          hint={t("lb.bonusPoolHint")}
        />
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
          title={t("lb.liveRanking", { metric: metricLabel })}
          description={t("lb.liveRankingDesc")}
        >
          <RankingBoard
            rows={rows}
            moves={moves}
            metric={{ ...metric, label: metricLabel }}
            onSelect={setSelected}
            bonusHint={bonusHint}
          />
        </SectionCard>
      </div>

      {/* AI insights */}
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <SectionCard
          title={t("lb.aiInsights")}
          description={
            aiSnapshot
              ? t("lb.aiUpdated", { time: new Date(aiSnapshot.at).toLocaleTimeString(lang) })
              : t("lb.aiInsightsDesc")
          }
          className="xl:col-span-2"
          actions={
            <button
              type="button"
              onClick={regenerate}
              className="inline-flex items-center gap-2 rounded-xl bg-mint px-3 py-1.5 text-xs font-semibold text-mint-foreground transition-colors hover:bg-mint-border"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {t("common.generate")}
            </button>
          }
        >
          <ul className="grid gap-3 sm:grid-cols-2">
            {(aiSnapshot?.items ?? insights).map((i) => (
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

        <SectionCard title={t("lb.lowest")} description={t("lb.lowestDesc")}>
          <ul className="space-y-3">
            {bottom.map((r) => (
              <li key={r.employee.id} className="flex items-center justify-between gap-3 text-sm">
                <button type="button" onClick={() => setSelected(r)} className="min-w-0 text-left">
                  <p className="truncate font-medium text-foreground hover:text-primary hover:underline">
                    {r.employee.name}
                  </p>
                  <p className="truncate text-[11px] text-subtle">
                    {r.employee.department} · #{r.rank}
                  </p>
                </button>
                <span className="shrink-0 text-xs text-destructive">
                  {r.monthlyKpi.toFixed(0)}% KPI
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      {/* Executive view */}
      <div className="mt-6">
        <SectionCard
          title={t("lb.exec")}
          description={t("lb.execDesc")}
          actions={
            <button
              type="button"
              onClick={() => setShowExec((v) => !v)}
              className="rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground"
            >
              {showExec ? t("common.hide") : t("common.show")}
            </button>
          }
        >
          {showExec && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-subtle">
                  <Users className="h-3.5 w-3.5" /> {t("lb.deptRanking")}
                </p>
                <ul className="space-y-3">
                  {depts.map((d, i) => (
                    <li key={d.name} className="flex items-center gap-3 text-sm">
                      <span className="w-5 text-xs text-subtle">{i + 1}</span>
                      <span className="w-32 truncate font-medium">{d.name}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full rounded-full bg-primary transition-[width] duration-700"
                          style={{
                            width: `${(d.revenue / Math.max(1, depts[0]!.revenue)) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="w-24 text-right tabular-nums text-muted-foreground">
                        {format(d.revenue)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-subtle">
                  <Building2 className="h-3.5 w-3.5" /> {t("lb.branchRanking")}
                </p>
                <ul className="space-y-3">
                  {branches.map((b, i) => (
                    <li key={b.name} className="flex items-center gap-3 text-sm">
                      <span className="w-5 text-xs text-subtle">{i + 1}</span>
                      <span className="w-32 truncate font-medium">{b.name}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full rounded-full bg-success transition-[width] duration-700"
                          style={{
                            width: `${(b.revenue / Math.max(1, branches[0]!.revenue)) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="w-16 text-right tabular-nums text-muted-foreground">
                        {b.kpi.toFixed(0)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 text-sm lg:col-span-2">
                <Activity className="h-4 w-4 shrink-0 text-primary" />
                {t("lb.companyKpi", {
                  kpi: `${totals.avgKpi.toFixed(1)}%`,
                  pool: format(totals.bonusPool),
                })}
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.employee.name}</DialogTitle>
              </DialogHeader>
              <p className="text-xs text-subtle">
                {t("emp.title")} · {selected.employee.department} · {selected.employee.branch} ·{" "}
                {selected.employee.team}
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-3">
                {[
                  [t("emp.position"), selected.employee.position],
                  [t("emp.rankNow"), `#${selected.rank}`],
                  [metricLabel, selected.metricLabel],
                  [t("col.revenue"), format(selected.revenue)],
                  [t("emp.monthRevenue"), format(selected.employee.monthlyRevenue)],
                  [t("emp.monthTarget"), format(selected.employee.monthlyTarget)],
                  [t("col.deals"), String(selected.employee.dealsClosed)],
                  [t("col.calls"), String(selected.employee.calls)],
                  [t("col.meetings"), String(selected.employee.meetings)],
                  [t("col.conversion"), `${selected.employee.conversion.toFixed(1)}%`],
                  [t("col.dailyKpi"), `${selected.dailyKpi.toFixed(0)}%`],
                  [t("col.monthlyKpi"), `${selected.monthlyKpi.toFixed(0)}%`],
                  [t("col.rating"), selected.employee.rating.toFixed(2)],
                  [t("emp.responseTime"), `${selected.employee.responseTime.toFixed(0)} min`],
                  [t("emp.attendance"), `${selected.employee.attendance.toFixed(0)}%`],
                  [t("emp.leadScore"), String(selected.employee.leadScore)],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-border bg-surface p-3">
                    <dt className="text-[11px] text-subtle">{k}</dt>
                    <dd className="mt-1 text-sm font-semibold text-foreground">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 rounded-xl bg-mint p-3 text-xs text-mint-foreground">
                {bonusHint(selected)}
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
