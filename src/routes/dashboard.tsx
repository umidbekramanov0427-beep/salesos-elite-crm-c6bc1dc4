import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
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
import { KPIS } from "@/lib/dashboard-data";
import { Skeleton } from "@/components/ui/skeleton";

const RevenueChart = lazy(() => import("@/components/dashboard/Charts").then((m) => ({ default: m.RevenueChart })));
const PipelineChart = lazy(() => import("@/components/dashboard/Charts").then((m) => ({ default: m.PipelineChart })));
const SalesFunnel = lazy(() => import("@/components/dashboard/Charts").then((m) => ({ default: m.SalesFunnel })));

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — SalesOS Elite" },
      {
        name: "description",
        content: "Revenue, pipeline, leaderboard, tasks and AI insights — the operating center of your sales team.",
      },
      { property: "og:title", content: "Dashboard — SalesOS Elite" },
      { property: "og:description", content: "Revenue, pipeline, leaderboard, tasks and AI insights in one command center." },
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
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <PageHeader title="Dashboard" description="The operating center of your revenue team." />

      <section className="mint-card grid gap-4 p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-foreground sm:text-2xl">{greeting()}, Aizhan 👋</h2>
          <p className="mt-1 text-xs text-subtle">{today}</p>
          <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-mint-foreground" />
            Today you closed 4 deals. Revenue is up 12.4% versus yesterday. Three important follow-ups require attention,
            and the Proposal stage is slowing down.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:w-[280px]">
          <div className="rounded-xl bg-background p-3">
            <p className="text-[11px] text-subtle">Today's revenue</p>
            <p className="mt-1 text-lg font-semibold text-foreground">$48,200</p>
          </div>
          <div className="rounded-xl bg-background p-3">
            <p className="text-[11px] text-subtle">Today's goal</p>
            <p className="mt-1 text-lg font-semibold text-foreground">$60,000</p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-success transition-[width] duration-700" style={{ width: "80%" }} />
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {KPIS.map((kpi) => (
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
