import { lazy, Suspense, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlarmClockOff, CalendarClock, PhoneCall, Sparkles } from "lucide-react";
import { PageHeader, SectionCard, StatCard, InfoTip } from "@/components/layout/Primitives";
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
  useAmoCrmTaskStats,
  useAsOfSnapshot,
  useDashboardKpis,
  useFunnelCallStats,
  useFunnelNames,
  useFunnelStats,
  type DealRow,
  type LeadRow,
} from "@/hooks/use-crm-data";
import { DateRangeFilter, type DateFilterValue } from "@/components/leaderboard/DateRangeFilter";
import { AmountRangeFilter, type AmountRangeValue } from "@/components/filters/AmountRangeFilter";
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
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    from?: string | undefined;
    to?: string | undefined;
    label?: string | undefined;
    funnel?: string | undefined;
    min?: string | undefined;
    max?: string | undefined;
  } => ({
    from: typeof search["from"] === "string" ? search["from"] : undefined,
    to: typeof search["to"] === "string" ? search["to"] : undefined,
    label: typeof search["label"] === "string" ? search["label"] : undefined,
    funnel: typeof search["funnel"] === "string" ? search["funnel"] : undefined,
    min: typeof search["min"] === "string" ? search["min"] : undefined,
    max: typeof search["max"] === "string" ? search["max"] : undefined,
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

  // Filters live in the URL (not local state) so refreshing the page or
  // navigating back keeps whatever was picked instead of resetting to
  // "nothing selected" -- same pattern used across Funnels/AmoCRM/Reyting.
  const dateFilter: DateFilterValue = useMemo(
    () => ({
      from: search.from ? new Date(search.from) : null,
      to: search.to ? new Date(search.to) : null,
      label: search.label ?? t("lb.presetAll"),
    }),
    [search.from, search.to, search.label, t],
  );
  const funnel = search.funnel ?? null;
  const amountRange: AmountRangeValue = useMemo(
    () => ({
      min: search.min !== undefined ? Number(search.min) : null,
      max: search.max !== undefined ? Number(search.max) : null,
    }),
    [search.min, search.max],
  );

  function setDateFilter(v: DateFilterValue) {
    void navigate({
      search: (prev) => ({
        ...prev,
        from: v.from ? v.from.toISOString() : undefined,
        to: v.to ? v.to.toISOString() : undefined,
        label: v.label || undefined,
      }),
      replace: true,
    });
  }
  function setFunnel(v: string | null) {
    void navigate({ search: (prev) => ({ ...prev, funnel: v ?? undefined }), replace: true });
  }
  function setAmountRange(v: AmountRangeValue) {
    void navigate({
      search: (prev) => ({
        ...prev,
        min: v.min != null ? String(v.min) : undefined,
        max: v.max != null ? String(v.max) : undefined,
      }),
      replace: true,
    });
  }

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
          tone="danger"
          emphasize
          info={t("dash.card.lostRevenueInfo")}
        />

        <div className="relative overflow-hidden rounded-2xl border border-border">
          <p className="flex items-center gap-1.5 p-4 pb-0 text-[13px] font-medium text-muted-foreground">
            {t("dash.card.tasks")}
            <InfoTip text={t("dash.card.tasksInfo")} />
          </p>
          <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-b-2xl bg-border">
            <div className="bg-success/10 p-4">
              <p className="flex items-center gap-1.5 text-xs font-medium text-success">
                <CalendarClock className="h-3.5 w-3.5" />
                {t("dash.card.tasksDueToday")}
              </p>
              <p className="mt-2 text-[26px] font-semibold leading-none text-success">
                {taskStats.data?.dueToday ?? 0}
              </p>
            </div>
            <div className="bg-destructive/10 p-4">
              <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                <AlarmClockOff className="h-3.5 w-3.5" />
                {t("dash.card.tasksOverdue")}
              </p>
              <p className="mt-2 text-[26px] font-semibold leading-none text-destructive">
                {taskStats.data?.overdue ?? 0}
              </p>
            </div>
          </div>
        </div>

        <div className="surface-card relative overflow-hidden border-l-4 border-l-blue-500 p-6">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
            <PhoneCall className="h-3.5 w-3.5" />
            {t("dash.card.callTime")}
            <InfoTip text={t("dash.card.callTimeInfo")} />
          </p>
          <p className="mt-1 text-[11px] text-subtle">
            {t("dash.card.callTimeManagers", { count: callStats.managerCount })}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div>
              <p className="text-lg font-semibold leading-none text-foreground">
                {formatCallDuration(callStats.totalSeconds)}
              </p>
              <p className="mt-1 text-[11px] text-subtle">{t("dash.card.callTimeTotal")}</p>
            </div>
            <div>
              <p className="text-lg font-semibold leading-none text-foreground">
                {formatCallDuration(callStats.avgSecondsPerManager)}
              </p>
              <p className="mt-1 text-[11px] text-subtle">{t("dash.card.callTimeAvg")}</p>
            </div>
            <div>
              <p className="text-lg font-semibold leading-none text-foreground">
                {callStats.avgContactsPerManager}
              </p>
              <p className="mt-1 text-[11px] text-subtle">{t("dash.card.callTimeContacts")}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-4">
        <Suspense fallback={<ChartSkeleton className="xl:col-span-2" />}>
          <RevenueChart />
        </Suspense>
        <Suspense fallback={<ChartSkeleton height={180} />}>
          <PipelineChart funnel={funnel} />
        </Suspense>
        <Suspense fallback={<ChartSkeleton height={220} />}>
          <SalesFunnel funnel={funnel} />
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
