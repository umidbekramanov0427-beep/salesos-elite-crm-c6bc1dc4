import { lazy, Suspense, useMemo } from "react";
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
import { PageHeader } from "@/components/layout/Primitives";
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
import { currency } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth";
import { useDashboardKpis, useRevenueSeries } from "@/hooks/use-crm-data";

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

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function Dashboard() {
  const { user } = useAuth();
  const kpis = useDashboardKpis();
  const revenueSeries = useRevenueSeries();
  const spark = useMemo(() => revenueSeries.map((r) => r.revenue), [revenueSeries]);

  const today = new Date().toLocaleDateString("en-US", {
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
      label: "Revenue today",
      value: currency(kpis.revenueToday),
      delta: 0,
      comparison: "won deals closed today",
      tooltip: "Sum of all deals marked Won today.",
      icon: Banknote,
      spark: spark.length ? spark : [0],
    },
    {
      id: "revenue-month",
      label: "Revenue this month",
      value: currency(kpis.revenueMonth),
      delta: 0,
      comparison: "month to date",
      tooltip: "Month-to-date closed revenue.",
      icon: CalendarRange,
      spark: spark.length ? spark : [0],
    },
    {
      id: "pipeline",
      label: "Pipeline value",
      value: currency(kpis.pipelineValue),
      delta: 0,
      comparison: `${kpis.openDealsCount} active deals`,
      tooltip: "Total value of all open opportunities.",
      icon: Layers3,
      spark: spark.length ? spark : [0],
    },
    {
      id: "new-leads",
      label: "New leads today",
      value: String(kpis.newLeadsToday),
      delta: 0,
      comparison: "created today",
      tooltip: "Leads created today.",
      icon: UserPlus,
      spark: spark.length ? spark : [0],
    },
    {
      id: "won",
      label: "Won deals",
      value: String(kpis.wonThisWeek),
      delta: 0,
      comparison: "this week",
      tooltip: "Deals moved to Won in the last 7 days.",
      icon: Trophy,
      spark: spark.length ? spark : [0],
    },
    {
      id: "lost",
      label: "Lost deals",
      value: String(kpis.lostThisWeek),
      delta: 0,
      comparison: "this week",
      tooltip: "Deals marked Lost in the last 7 days. Lower is better.",
      icon: XCircle,
      spark: spark.length ? spark : [0],
    },
    {
      id: "conversion",
      label: "Conversion rate",
      value: `${kpis.conversion.toFixed(1)}%`,
      delta: 0,
      comparison: "lead → won",
      tooltip: "Percentage of leads that reached the Won stage.",
      icon: Percent,
      spark: spark.length ? spark : [0],
    },
    {
      id: "employee-kpi",
      label: "Today's goal",
      value: `${goalPct}%`,
      delta: 0,
      comparison: `of ${currency(todayGoal)} target`,
      tooltip: "Your progress toward today's revenue target.",
      icon: Gauge,
      spark: spark.length ? spark : [0],
    },
  ];

  return (
    <>
      <PageHeader title="Dashboard" description="The operating center of your revenue team." />

      <section className="mint-card grid gap-4 p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
            {greeting()}, {user?.name?.split(" ")[0] ?? "there"} 👋
          </h2>
          <p className="mt-1 text-xs text-subtle">{today}</p>
          <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-mint-foreground" />
            {kpis.wonThisWeek > 0 || kpis.newLeadsToday > 0
              ? `This week: ${kpis.wonThisWeek} deal${kpis.wonThisWeek === 1 ? "" : "s"} won, ${kpis.newLeadsToday} new lead${kpis.newLeadsToday === 1 ? "" : "s"} today.`
              : "Add leads and deals to see live insights here."}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:w-[280px]">
          <div className="rounded-xl bg-background p-3">
            <p className="text-[11px] text-subtle">Today's revenue</p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {currency(kpis.revenueToday)}
            </p>
          </div>
          <div className="rounded-xl bg-background p-3">
            <p className="text-[11px] text-subtle">Today's goal</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{currency(todayGoal)}</p>
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
