import { lazy, Suspense, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Banknote,
  CalendarRange,
  Gauge,
  Layers3,
  Percent,
  Sparkles,
  Trophy,
  UserPlus,
  XCircle,
} from "lucide-react";
import { PageHeader, SectionCard } from "@/components/layout/Primitives";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import {
  LeaderboardWidget,
  ImportantTasksWidget,
  LeadTasksWidget,
  InboxWidget,
  ActivityWidget,
  AudioPreviewWidget,
  AiInsightsWidget,
} from "@/components/dashboard/Widgets";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import {
  useAsOfSnapshot,
  useDashboardKpis,
  useFunnelNames,
  useRevenueSeries,
  type DealRow,
  type LeadRow,
} from "@/hooks/use-crm-data";
import { DateRangeFilter, type DateFilterValue } from "@/components/leaderboard/DateRangeFilter";
import {
  AmountRangeFilter,
  EMPTY_AMOUNT_RANGE,
  type AmountRangeValue,
} from "@/components/filters/AmountRangeFilter";
import { AsOfDatePicker, AsOfBanner } from "@/components/filters/AsOfDatePicker";

const RevenueChart = lazy(() =>
  import("@/components/dashboard/Charts").then((m) => ({ default: m.RevenueChart })),
);
const PipelineChart = lazy(() =>
  import("@/components/dashboard/Charts").then((m) => ({ default: m.PipelineChart })),
);
const SalesFunnel = lazy(() =>
  import("@/components/dashboard/Charts").then((m) => ({ default: m.SalesFunnel })),
);

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — SalesOS Elite" },
      {
        name: "description",
        content:
          "Revenue, pipeline, leaderboard, tasks and AI insights — the operating center of your sales team.",
      },
      { property: "og:title", content: "Dashboard — SalesOS Elite" },
      {
        property: "og:description",
        content: "Revenue, pipeline, leaderboard, tasks and AI insights in one command center.",
      },
    ],
  }),
  component: Dashboard,
});

function ChartSkeleton({ height = 300, className }: { height?: number; className?: string }) {
  return (
    <div className={`surface-card p-6 ${className ?? ""}`}>
      <Skeleton className="h-5 w-40" />
      <Skeleton className="mt-2 h-3 w-56" />
      <Skeleton className="mt-6 w-full rounded-xl" style={{ height }} />
    </div>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const { format } = useCurrency();
  const [dateFilter, setDateFilter] = useState<DateFilterValue>({
    from: null,
    to: null,
    label: t("lb.presetAll"),
  });
  const [funnel, setFunnel] = useState<string | null>(null);
  const [amountRange, setAmountRange] = useState<AmountRangeValue>(EMPTY_AMOUNT_RANGE);
  const [asOfDate, setAsOfDate] = useState<Date | null>(null);
  const asOfLeads = useAsOfSnapshot<LeadRow>("leads", asOfDate);
  const asOfDeals = useAsOfSnapshot<DealRow>("deals", asOfDate);
  const { names: funnelNames } = useFunnelNames();
  const dashboardFilters = useMemo(
    () => ({
      from: dateFilter.from ? dateFilter.from.toISOString() : null,
      to: dateFilter.to ? dateFilter.to.toISOString() : null,
      funnel,
      minAmount: amountRange.min,
      maxAmount: amountRange.max,
    }),
    [dateFilter, funnel, amountRange],
  );
  const kpis = useDashboardKpis(
    dashboardFilters,
    asOfDate ? { leads: asOfLeads.data ?? [], deals: asOfDeals.data ?? [] } : undefined,
  );
  const revenueSeries = useRevenueSeries();
  const spark = useMemo(() => revenueSeries.map((r) => r.revenue), [revenueSeries]);

  function greeting() {
    const h = new Date().getHours();
    if (h < 12) return t("dash.greetingMorning");
    if (h < 18) return t("dash.greetingAfternoon");
    return t("dash.greetingEvening");
  }

  const today = new Date().toLocaleDateString(lang === "uz" ? "en-US" : lang, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const todayGoal = user?.dailyTarget ?? 3000;
  const goalPct = todayGoal ? Math.min(100, Math.round((kpis.revenueToday / todayGoal) * 100)) : 0;

  const kpiCards = [
    {
      id: "revenue-today",
      label: t("kpi.revenueToday"),
      value: format(kpis.revenueToday),
      delta: 0,
      comparison: t("kpi.revenueTodayHint"),
      tooltip: t("kpi.revenueTodayTip"),
      icon: Banknote,
      spark: spark.length ? spark : [0],
    },
    {
      id: "revenue-month",
      label: t("kpi.revenueMonth"),
      value: format(kpis.revenueMonth),
      delta: 0,
      comparison: t("kpi.revenueMonthHint"),
      tooltip: t("kpi.revenueMonthTip"),
      icon: CalendarRange,
      spark: spark.length ? spark : [0],
    },
    {
      id: "pipeline",
      label: t("kpi.pipeline"),
      value: format(kpis.pipelineValue),
      delta: 0,
      comparison: t("kpi.pipelineHint", { count: kpis.openDealsCount }),
      tooltip: t("kpi.pipelineTip"),
      icon: Layers3,
      spark: spark.length ? spark : [0],
    },
    {
      id: "new-leads",
      label: t("kpi.newLeads"),
      value: String(kpis.newLeadsToday),
      delta: 0,
      comparison: t("kpi.newLeadsHint"),
      tooltip: t("kpi.newLeadsTip"),
      icon: UserPlus,
      spark: spark.length ? spark : [0],
    },
    {
      id: "won",
      label: t("kpi.won"),
      value: String(kpis.wonThisWeek),
      delta: 0,
      comparison: t("kpi.wonHint"),
      tooltip: t("kpi.wonTip"),
      icon: Trophy,
      spark: spark.length ? spark : [0],
    },
    {
      id: "lost",
      label: t("kpi.lost"),
      value: String(kpis.lostThisWeek),
      delta: 0,
      comparison: t("kpi.lostHint"),
      tooltip: t("kpi.lostTip"),
      icon: XCircle,
      spark: spark.length ? spark : [0],
    },
    {
      id: "conversion",
      label: t("kpi.conversion"),
      value: `${kpis.conversion.toFixed(1)}%`,
      delta: 0,
      comparison: t("kpi.conversionHint"),
      tooltip: t("kpi.conversionTip"),
      icon: Percent,
      spark: spark.length ? spark : [0],
    },
    {
      id: "employee-kpi",
      label: t("kpi.todayGoal"),
      value: `${goalPct}%`,
      delta: 0,
      comparison: t("kpi.todayGoalHint", { target: format(todayGoal) }),
      tooltip: t("kpi.todayGoalTip"),
      icon: Gauge,
      spark: spark.length ? spark : [0],
    },
  ];

  return (
    <>
      <PageHeader title={t("dash.title")} description={t("dash.desc")} />

      <SectionCard title={t("lb.filters")} className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <DateRangeFilter value={dateFilter} onChange={setDateFilter} />
          <select
            value={funnel ?? ""}
            onChange={(e) => setFunnel(e.target.value || null)}
            className="h-9 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <option value="">{t("leadFilter.allFunnels")}</option>
            {funnelNames.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <AmountRangeFilter value={amountRange} onChange={setAmountRange} />
          <AsOfDatePicker value={asOfDate} onChange={setAsOfDate} />
        </div>
      </SectionCard>

      <AsOfBanner value={asOfDate} />

      <section className="mint-card grid gap-4 p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
            {greeting()}, {user?.name?.split(" ")[0] ?? t("dash.friend")} 👋
          </h2>
          <p className="mt-1 text-xs text-subtle">{today}</p>
          <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-mint-foreground" />
            {kpis.wonThisWeek > 0 || kpis.newLeadsToday > 0
              ? t("dash.weekSummary", { won: kpis.wonThisWeek, leads: kpis.newLeadsToday })
              : t("dash.weekSummaryEmpty")}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:w-[300px]">
          <div className="min-w-0 rounded-xl bg-background p-3">
            <p className="text-[11px] text-subtle">{t("dash.todayRevenue")}</p>
            <p className="mt-1 truncate text-base font-semibold text-foreground sm:text-lg">
              {format(kpis.revenueToday)}
            </p>
          </div>
          <div className="min-w-0 rounded-xl bg-background p-3">
            <p className="text-[11px] text-subtle">{t("dash.todayGoal")}</p>
            <p className="mt-1 truncate text-base font-semibold text-foreground sm:text-lg">
              {format(todayGoal)}
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-success transition-[width] duration-700"
                style={{ width: `${goalPct}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} />
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-4">
        <Suspense fallback={<ChartSkeleton className="xl:col-span-2" />}>
          <RevenueChart />
        </Suspense>
        <Suspense fallback={<ChartSkeleton height={180} />}>
          <PipelineChart />
        </Suspense>
        <Suspense fallback={<ChartSkeleton height={220} />}>
          <SalesFunnel />
        </Suspense>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <LeaderboardWidget />
        <ImportantTasksWidget />
        <LeadTasksWidget />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <InboxWidget />
        <ActivityWidget />
        <AudioPreviewWidget />
      </div>

      <div className="mt-6">
        <AiInsightsWidget />
      </div>

      <QuickActions />
    </>
  );
}
