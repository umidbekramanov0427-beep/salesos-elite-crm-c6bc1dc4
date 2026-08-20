import { lazy, Suspense, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlarmClockOff,
  CalendarClock,
  GitBranch,
  PhoneCall,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { PageHeader, SectionCard, StatCard, InfoTip } from "@/components/layout/Primitives";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { DashboardDailyReport } from "@/components/dashboard/DailyReport";
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
  useAmoCrmTaskStats,
  useDashboardKpis,
  useFunnelCallStats,
  useFunnelNames,
  useFunnelStats,
  useProfilesRaw,
} from "@/hooks/use-crm-data";
import { FilterTile, TileOption } from "@/components/filters/FilterTile";

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
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const { format } = useCurrency();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  // Funnel lives in the URL (not local state) so refreshing the page or
  // navigating back keeps whatever was picked instead of resetting to
  // "nothing selected" -- same pattern used across Funnels/AmoCRM/Reyting.
  // Team/operator are page-session-only, matching how the rest of the
  // platform's JAMOA/OPERATOR filters (Lid tahlili, this same tile) behave.
  const funnel = search.funnel ?? null;
  const [teamId, setTeamId] = useState("");
  const [operatorId, setOperatorId] = useState("");

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

  const kpis = useDashboardKpis({ from: null, to: null, funnel });
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

  // Same per-funnel computation Reyting uses (raw leads + pipeline_stages,
  // not the dashboard_kpis RPC) -- these 8 cards are all about one funnel's
  // real pipeline shape, which that RPC was never built to answer.
  const funnelStats = useFunnelStats(funnel);
  const callStats = useFunnelCallStats(funnel);
  const taskStats = useAmoCrmTaskStats(funnel);

  // "Kutilayotgan konversiya" -- the org's fixed expected conversion rate,
  // used only to project potential/lost revenue below (not a real measured
  // number, so it isn't sourced from any hook).
  const EXPECTED_CONVERSION = 0.15;
  const potentialSalesCount = Math.round(funnelStats.totalLeads * EXPECTED_CONVERSION);
  const potentialRevenue = potentialSalesCount * funnelStats.avgCheck;
  const lostRevenue = funnelStats.lostCount * EXPECTED_CONVERSION * funnelStats.avgCheck;

  function formatCallDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  return (
    <>
      <PageHeader title={t("dash.title")} description={t("dash.desc")} />

      <SectionCard title={t("dash.dailyReport")} className="mb-6" info={t("dash.filtersInfo")}>
        <div className="flex flex-wrap items-center gap-3">
          <FilterTile
            icon={Users}
            label={t("leadAnalytics.jamoaLabel")}
            value={rops.find((r) => r.id === teamId)?.full_name ?? t("leadAnalytics.allTeams")}
          >
            <TileOption
              label={t("leadAnalytics.allTeams")}
              active={!teamId}
              onClick={() => {
                setTeamId("");
                setOperatorId("");
              }}
            />
            {rops.map((r) => (
              <TileOption
                key={r.id}
                label={r.full_name}
                active={teamId === r.id}
                onClick={() => {
                  setTeamId(r.id);
                  setOperatorId("");
                }}
              />
            ))}
          </FilterTile>
          <FilterTile
            icon={User}
            label={t("leadAnalytics.operatorLabel")}
            value={
              operators.find((m) => m.id === operatorId)?.full_name ??
              t("leadAnalytics.allManagers")
            }
          >
            <TileOption
              label={t("leadAnalytics.allManagers")}
              active={!operatorId}
              onClick={() => setOperatorId("")}
            />
            {operators.map((m) => (
              <TileOption
                key={m.id}
                label={m.full_name}
                active={operatorId === m.id}
                onClick={() => setOperatorId(m.id)}
              />
            ))}
          </FilterTile>
          <FilterTile
            icon={GitBranch}
            label={t("leadAnalytics.funnelLabel")}
            value={funnel ?? t("leadFilter.allFunnels")}
          >
            <TileOption
              label={t("leadFilter.allFunnels")}
              active={!funnel}
              onClick={() => setFunnel(null)}
            />
            {funnelNames.map((f) => (
              <TileOption key={f} label={f} active={funnel === f} onClick={() => setFunnel(f)} />
            ))}
          </FilterTile>
        </div>
      </SectionCard>

      <section className="mint-card grid gap-4 p-6">
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
      </section>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("dash.card.totalLeads")}
          value={String(funnelStats.totalLeads)}
          info={t("dash.card.totalLeadsInfo")}
        />
        <StatCard
          label={t("dash.card.totalRevenue")}
          value={format(funnelStats.totalRevenue)}
          tone="mint"
          info={t("dash.card.totalRevenueInfo")}
        />
        <StatCard
          label={t("dash.card.conversion")}
          value={`${funnelStats.conversion.toFixed(1)}%`}
          hint={t("dash.card.expectedConversion")}
          info={t("dash.card.conversionInfo")}
        />
        <StatCard
          label={t("dash.card.potentialSales")}
          value={String(potentialSalesCount)}
          hint={format(potentialRevenue)}
          tone="mint"
          info={t("dash.card.potentialSalesInfo")}
        />
        <StatCard
          label={t("dash.card.lostLeads")}
          value={String(funnelStats.lostCount)}
          info={t("dash.card.lostLeadsInfo")}
        />
        <StatCard
          label={t("dash.card.lostRevenue")}
          value={format(lostRevenue)}
          tone="danger-soft"
          info={t("dash.card.lostRevenueInfo")}
        />

        <div className="surface-card relative overflow-hidden p-6 before:absolute before:inset-y-0 before:left-0 before:w-1.5 before:bg-violet-500">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
            {t("dash.card.tasks")}
            <InfoTip text={t("dash.card.tasksInfo")} />
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-success/10 p-3">
              <p className="flex items-center gap-1 text-[11px] font-semibold text-success">
                <CalendarClock className="h-3 w-3" />
                {t("dash.card.tasksDueToday")}
              </p>
              <p className="mt-2 text-[26px] font-bold leading-none tabular-nums text-success">
                {taskStats.data?.dueToday ?? 0}
              </p>
            </div>
            <div className="rounded-xl bg-destructive/10 p-3">
              <p className="flex items-center gap-1 text-[11px] font-semibold text-destructive">
                <AlarmClockOff className="h-3 w-3" />
                {t("dash.card.tasksOverdue")}
              </p>
              <p className="mt-2 text-[26px] font-bold leading-none tabular-nums text-destructive">
                {taskStats.data?.overdue ?? 0}
              </p>
            </div>
          </div>
        </div>

        <div className="surface-card relative overflow-hidden p-6 before:absolute before:inset-y-0 before:left-0 before:w-1.5 before:bg-blue-500">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
            <PhoneCall className="h-3.5 w-3.5" />
            {t("dash.card.callTime")}
            <InfoTip text={t("dash.card.callTimeInfo")} />
          </p>
          <p className="mt-1 text-xs font-medium text-subtle">
            {t("dash.card.callTimeManagers", { count: callStats.managerCount })}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div>
              <p className="text-lg font-bold leading-none tabular-nums text-foreground">
                {formatCallDuration(callStats.totalSeconds)}
              </p>
              <p className="mt-1.5 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-subtle">
                {t("dash.card.callTimeTotal")}
              </p>
            </div>
            <div>
              <p className="text-lg font-bold leading-none tabular-nums text-foreground">
                {formatCallDuration(callStats.avgSecondsPerManager)}
              </p>
              <p className="mt-1.5 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-subtle">
                {t("dash.card.callTimeAvg")}
              </p>
            </div>
            <div>
              <p className="text-lg font-bold leading-none tabular-nums text-foreground">
                {callStats.avgContactsPerManager}
              </p>
              <p className="mt-1.5 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-subtle">
                {t("dash.card.callTimeContacts")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <DashboardDailyReport
        funnel={funnel}
        teamId={teamId || null}
        operatorId={operatorId || null}
      />

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
          <RevenueByOwnerChart funnel={funnel} />
        </Suspense>
      </div>

      <div className="mt-6">
        <Suspense fallback={<ChartSkeleton />}>
          <LostReasonsChart funnel={funnel} />
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
        <LeaderboardWidget />
        <ImportantTasksWidget />
        <LeadTasksWidget funnel={funnel} />
      </div>

      <div className="mt-6 space-y-6">
        <InboxWidget />
        <ActivityWidget funnel={funnel} />
        <AudioPreviewWidget funnel={funnel} />
      </div>

      <div className="mt-6">
        <AiInsightsWidget />
      </div>

      <QuickActions />
    </>
  );
}
