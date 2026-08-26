import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/Primitives";
import { QuickActions } from "@/components/dashboard/QuickActions";
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

  // Funnel lives in the URL (not local state) so refreshing the page or
  // navigating back keeps whatever was picked instead of resetting to
  // "nothing selected" -- same pattern used across Funnels/AmoCRM/Reyting.
  // The Kunlik hisobot card (with its own team/operator/date/amount filter
  // row and the 8 KPI cards) used to live at the top of this page -- it's
  // now its own sidebar entry (/daily-report), so the charts below just
  // read `funnel` from this page's own URL instead of a shared filter row.
  const funnel = search.funnel ?? null;
  // No date-range picker lives on this page anymore (it moved with the
  // daily report), so the few charts that take a range just get "all time".
  const allTime = { from: null, to: null };

  return (
    <>
      <PageHeader title={t("dash.title")} description={t("dash.desc")} />

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
          <RevenueByOwnerChart funnel={funnel} dateRange={allTime} />
        </Suspense>
      </div>

      <div className="mt-6">
        <Suspense fallback={<ChartSkeleton />}>
          <LostReasonsChart funnel={funnel} dateRange={allTime} />
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
        <AiInsightsWidget funnel={funnel} dateRange={allTime} />
      </div>

      <QuickActions />
    </>
  );
}
