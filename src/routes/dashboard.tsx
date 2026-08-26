import { lazy, Suspense, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, SectionCard } from "@/components/layout/Primitives";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { DashboardFilterRow, DashboardKpiCards } from "@/components/dashboard/DailyReport";
import {
  ImportantTasksWidget,
  LeadTasksWidget,
  InboxWidget,
  ActivityWidget,
  AudioPreviewWidget,
  AiInsightsWidget,
} from "@/components/dashboard/Widgets";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { useFunnelNames, useProfilesRaw } from "@/hooks/use-crm-data";
import type { DateFilterValue } from "@/components/leaderboard/DateRangeFilter";
import type { AmountRangeValue } from "@/components/filters/AmountRangeFilter";

const RevenueChart = lazy(() =>
  import("@/components/dashboard/Charts").then((m) => ({ default: m.RevenueChart })),
);
const PipelineChart = lazy(() =>
  import("@/components/dashboard/Charts").then((m) => ({ default: m.PipelineChart })),
);
const SalesFunnel = lazy(() =>
  import("@/components/dashboard/Charts").then((m) => ({ default: m.SalesFunnel })),
);
const MonthlyRevenueTrendChart = lazy(() =>
  import("@/components/dashboard/Charts").then((m) => ({ default: m.MonthlyRevenueTrendChart })),
);
const RevenueByOwnerChart = lazy(() =>
  import("@/components/dashboard/Charts").then((m) => ({ default: m.RevenueByOwnerChart })),
);
const LostReasonsChart = lazy(() =>
  import("@/components/dashboard/Charts").then((m) => ({ default: m.LostReasonsChart })),
);
const DealFlowChart = lazy(() =>
  import("@/components/dashboard/Charts").then((m) => ({ default: m.DealFlowChart })),
);
const ConversionQualityChart = lazy(() =>
  import("@/components/dashboard/Charts").then((m) => ({ default: m.ConversionQualityChart })),
);

export const Route = createFileRoute("/dashboard")({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    funnel?: string | undefined;
  } => ({
    funnel: typeof search["funnel"] === "string" ? search["funnel"] : undefined,
  }),
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
  const { t } = useI18n();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  // Funnel lives in the URL (not local state) so refreshing the page or
  // navigating back keeps whatever was picked instead of resetting to
  // "nothing selected" -- same pattern used across Funnels/AmoCRM/Reyting.
  // The 5-section Kunlik hisobot report moved out to its own sidebar page
  // (/daily-report), but this page keeps its own filter row and the 8 KPI
  // cards -- they drive the charts below, independent of daily-report's
  // own filter state.
  const funnel = search.funnel ?? null;
  const [teamId, setTeamId] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilterValue>({
    from: null,
    to: null,
    label: t("lb.presetAll"),
  });
  const [amountRange, setAmountRange] = useState<AmountRangeValue>({ min: null, max: null });

  function setFunnel(v: string | null) {
    void navigate({ search: (prev) => ({ ...prev, funnel: v ?? undefined }), replace: true });
  }

  const { names: funnelNames } = useFunnelNames();
  const { data: profiles } = useProfilesRaw();
  const rops = useMemo(
    () =>
      (profiles ?? [])
        .filter((p) => p.role === "rop")
        .slice()
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [profiles],
  );
  const operators = useMemo(() => {
    const all = (profiles ?? []).slice().sort((a, b) => a.full_name.localeCompare(b.full_name));
    if (!teamId) return all;
    return all.filter((p) => p.id === teamId || p.manager_id === teamId);
  }, [profiles, teamId]);

  const dateRange = { from: dateFilter.from, to: dateFilter.to };

  return (
    <>
      <PageHeader title={t("dash.title")} description={t("dash.desc")} />

      <div className="mt-6">
        <SectionCard title={t("lb.filters")}>
          <DashboardFilterRow
            funnel={funnel}
            onFunnelChange={setFunnel}
            teamId={teamId || null}
            onTeamChange={(v) => setTeamId(v ?? "")}
            operatorId={operatorId || null}
            onOperatorChange={(v) => setOperatorId(v ?? "")}
            dateFilter={dateFilter}
            onDateFilterChange={setDateFilter}
            amountRange={amountRange}
            onAmountRangeChange={setAmountRange}
            funnelNames={funnelNames}
            rops={rops}
            operators={operators}
          />
        </SectionCard>
      </div>

      <div className="mt-6">
        <DashboardKpiCards funnel={funnel} />
      </div>

      <div className="mt-6 space-y-6">
        <Suspense fallback={<ChartSkeleton />}>
          <RevenueChart />
        </Suspense>
        <Suspense fallback={<ChartSkeleton height={180} />}>
          <PipelineChart funnel={funnel} />
        </Suspense>
        <Suspense fallback={<ChartSkeleton height={220} />}>
          <SalesFunnel funnel={funnel} />
        </Suspense>
      </div>

      <div className="mt-6 space-y-6">
        <Suspense fallback={<ChartSkeleton />}>
          <MonthlyRevenueTrendChart funnel={funnel} />
        </Suspense>
        <Suspense fallback={<ChartSkeleton />}>
          <RevenueByOwnerChart funnel={funnel} dateRange={dateRange} />
        </Suspense>
      </div>

      <div className="mt-6">
        <Suspense fallback={<ChartSkeleton />}>
          <LostReasonsChart funnel={funnel} dateRange={dateRange} />
        </Suspense>
      </div>

      <div className="mt-6 space-y-6">
        <Suspense fallback={<ChartSkeleton height={320} />}>
          <DealFlowChart funnel={funnel} />
        </Suspense>
        <Suspense fallback={<ChartSkeleton height={340} />}>
          <ConversionQualityChart funnel={funnel} />
        </Suspense>
      </div>

      <div className="mt-6 space-y-6">
        <ImportantTasksWidget />
        <LeadTasksWidget funnel={funnel} />
      </div>

      <div className="mt-6 space-y-6">
        <InboxWidget />
        <ActivityWidget funnel={funnel} />
        <AudioPreviewWidget funnel={funnel} />
      </div>

      <div className="mt-6">
        <AiInsightsWidget funnel={funnel} dateRange={dateRange} />
      </div>

      <QuickActions />
    </>
  );
}
