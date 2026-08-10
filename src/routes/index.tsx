import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Crown, Loader2, Play, RefreshCw, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionCard, StatCard, ExportButton } from "@/components/layout/Primitives";
import { cn } from "@/lib/utils";
import { useI18n, type Lang } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import {
  useAiAssistantChat,
  useFunnelNames,
  useLeaderboardView,
  usePipelineStagesRaw,
  useTagsSummary,
  type LeaderboardManagerRow,
} from "@/hooks/use-crm-data";
import { DateRangeFilter, type DateFilterValue } from "@/components/leaderboard/DateRangeFilter";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Reyting — SalesOS Elite CRM" },
      {
        name: "description",
        content: "Real sales leaderboard: revenue, conversion, KPI and target completion per rep.",
      },
      { property: "og:title", content: "Reyting — SalesOS Elite CRM" },
      { property: "og:description", content: "Real-time ranking for the whole revenue org." },
    ],
  }),
  component: Leaderboard,
});

const LANG_NAME: Record<Lang, string> = { uz: "o'zbek", ru: "русский", en: "English" };
const LIVE_REFRESH_MS = 3000;

function pct(n: number): string {
  return `${Math.round(n * 10) / 10}%`;
}

function TagFilter({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  function toggle(tag: string) {
    onChange(selected.includes(tag) ? selected.filter((t2) => t2 !== tag) : [...selected, tag]);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors hover:border-primary/40"
      >
        {t("lb.tagsFilter")}
        {selected.length > 0 && (
          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
            {selected.length}
          </span>
        )}
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default"
            aria-label={t("common.close")}
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full z-20 mt-2 max-h-64 w-56 space-y-1 overflow-y-auto rounded-xl border border-border bg-popover p-2 shadow-card">
            {options.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-subtle">{t("common.none")}</p>
            )}
            {options.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggle(tag)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                  selected.includes(tag) && "bg-primary/10 text-primary",
                )}
              >
                <span className="truncate">{tag}</span>
                {selected.includes(tag) && <span>✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ManagerCard({ row, place }: { row: LeaderboardManagerRow; place: number }) {
  const { t } = useI18n();
  const { format } = useCurrency();
  const toneByPlace = [
    "border-amber-400/50 bg-amber-400/5",
    "border-slate-400/40",
    "border-orange-400/40",
  ];
  return (
    <div className={cn("surface-card space-y-3 border p-5", toneByPlace[place])}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mint text-sm font-bold text-mint-foreground">
          {row.initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">{row.name}</p>
          <p className="text-[11px] text-subtle">#{place + 1}</p>
        </div>
        {place === 0 && <Crown className="h-5 w-5 shrink-0 text-amber-500" />}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-surface p-2">
          <p className="text-subtle">{t("lb.colRevenue")}</p>
          <p className="mt-0.5 font-bold text-foreground">{format(row.revenue)}</p>
        </div>
        <div className="rounded-lg bg-surface p-2">
          <p className="text-subtle">{t("lb.colWonLeads")}</p>
          <p className="mt-0.5 font-bold text-foreground">{row.wonLeads}</p>
        </div>
        <div className="rounded-lg bg-surface p-2">
          <p className="text-subtle">{t("lb.colConversion")}</p>
          <p className="mt-0.5 font-bold text-success">{pct(row.conversion)}</p>
        </div>
        <div className="rounded-lg bg-surface p-2">
          <p className="text-subtle">{t("lb.colTotalLeads")}</p>
          <p className="mt-0.5 font-bold text-foreground">{row.totalLeads}</p>
        </div>
      </div>
    </div>
  );
}

function Leaderboard() {
  const { t, lang } = useI18n();
  const { format } = useCurrency();
  const chat = useAiAssistantChat();

  const [dateFilter, setDateFilter] = useState<DateFilterValue>({
    from: null,
    to: null,
    label: t("lb.presetAll"),
  });
  const [search, setSearch] = useState("");
  const [stageId, setStageId] = useState<string | null>(null);
  const [funnel, setFunnel] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [live, setLive] = useState(true);

  const { data: stageOptions } = usePipelineStagesRaw();
  const { names: funnelNames } = useFunnelNames();
  const { tags: tagSummary } = useTagsSummary();

  const filters = useMemo(
    () => ({
      from: dateFilter.from ? dateFilter.from.toISOString() : null,
      to: dateFilter.to ? dateFilter.to.toISOString() : null,
      search,
      stageId,
      funnel,
      tags: selectedTags,
    }),
    [dateFilter, search, stageId, funnel, selectedTags],
  );
  const { rows, isLoading, isFetching, refetch } = useLeaderboardView(filters, {
    refetchInterval: live ? LIVE_REFRESH_MS : false,
  });

  const todayIso = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);
  const { rows: todayRows } = useLeaderboardView(
    {
      from: todayIso,
      to: null,
      search: "",
      stageId: null,
      funnel: null,
      tags: [],
    },
    { refetchInterval: live ? LIVE_REFRESH_MS : false },
  );

  async function handleManualRefresh() {
    await refetch();
    toast.success(t("lb.refreshed"));
  }

  const totals = useMemo(() => {
    const totalLeads = rows.reduce((s, r) => s + r.totalLeads, 0);
    const wonLeads = rows.reduce((s, r) => s + r.wonLeads, 0);
    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    const todayRevenue = todayRows.reduce((s, r) => s + r.revenue, 0);
    const avgConversion = totalLeads ? (wonLeads / totalLeads) * 100 : 0;
    return { totalLeads, wonLeads, revenue, todayRevenue, avgConversion };
  }, [rows, todayRows]);

  const [topSummary, setTopSummary] = useState<string | null>(null);
  const [bottomSummary, setBottomSummary] = useState<string | null>(null);
  const [topBusy, setTopBusy] = useState(false);
  const [bottomBusy, setBottomBusy] = useState(false);

  const top3 = rows.slice(0, 3);
  const bottom3 = rows.length > 3 ? [...rows].slice(-3).reverse() : [];

  async function generateTopSummary() {
    if (top3.length === 0) return;
    setTopBusy(true);
    try {
      const data = top3
        .map(
          (r, i) =>
            `${i + 1}. ${r.name}: revenue ${format(r.revenue)}, conversion ${pct(r.conversion)}, total leads ${r.totalLeads}, won leads ${r.wonLeads}, target completion ${pct(r.targetCompletion)}`,
        )
        .join("\n");
      const reply = await chat.mutateAsync([
        {
          role: "user",
          content: `Here are the top-3 sales managers this period:\n${data}\n\nWrite a short summary (3-5 sentences) of what specifically these top performers are doing right, based on their numbers. Respond in ${LANG_NAME[lang]}.`,
        },
      ]);
      setTopSummary(reply);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("lb.aiFailed"));
    } finally {
      setTopBusy(false);
    }
  }

  async function generateBottomSummary() {
    if (bottom3.length === 0) return;
    setBottomBusy(true);
    try {
      const data = bottom3
        .map(
          (r) =>
            `${r.name}: revenue ${format(r.revenue)}, conversion ${pct(r.conversion)}, total leads ${r.totalLeads}, won leads ${r.wonLeads}, lost leads ${r.lostLeads}, KPI ${pct(r.kpiPercent)}, target completion ${pct(r.targetCompletion)}`,
        )
        .join("\n");
      const reply = await chat.mutateAsync([
        {
          role: "user",
          content: `Here are the 3 lowest-performing sales managers this period:\n${data}\n\nWrite a short summary (3-5 sentences) of what's likely going wrong for each, and concrete feedback on what they should work on to improve. Respond in ${LANG_NAME[lang]}.`,
        },
      ]);
      setBottomSummary(reply);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("lb.aiFailed"));
    } finally {
      setBottomBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t("lb.title")}
        description={t("lb.description2")}
        actions={
          <>
            <button
              type="button"
              onClick={() => setLive((v) => !v)}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-colors",
                live
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-border bg-background text-muted-foreground hover:bg-accent",
              )}
            >
              {live ? (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                </span>
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              {live ? t("lb.live") : t("lb.paused")}
            </button>
            <button
              type="button"
              onClick={() => void handleManualRefresh()}
              disabled={isFetching}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
              {t("common.refresh")}
            </button>
            <ExportButton
              filename="leaderboard"
              rows={rows.map((r, i) => ({
                Rank: i + 1,
                Manager: r.name,
                TotalLeads: r.totalLeads,
                WonLeads: r.wonLeads,
                Revenue: r.revenue,
                Conversion: r.conversion,
                Kpi: r.kpiPercent,
                Bonus: Math.round(r.revenue * 0.05),
                TargetCompletion: r.targetCompletion,
              }))}
            />
          </>
        }
      />

      <SectionCard title={t("lb.filters")}>
        <div className="flex flex-wrap items-end gap-3">
          <DateRangeFilter value={dateFilter} onChange={setDateFilter} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("lb.searchPlaceholder")}
            className="h-9 w-56 rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          <select
            value={stageId ?? ""}
            onChange={(e) => setStageId(e.target.value || null)}
            className="h-9 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <option value="">{t("lb.stageFilter")}</option>
            {(stageOptions ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
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
          <TagFilter
            options={tagSummary.map((tg) => tg.name)}
            selected={selectedTags}
            onChange={setSelectedTags}
          />
        </div>
      </SectionCard>

      {isLoading && (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
        </div>
      )}

      <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("lb.todayRevenue")} value={format(totals.todayRevenue)} tone="mint" />
        <StatCard label={t("lb.avgConversion")} value={pct(totals.avgConversion)} />
        <StatCard label={t("lb.totalWonLeads")} value={String(totals.wonLeads)} />
        <StatCard label={t("lb.totalRevenue")} value={format(totals.revenue)} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        {top3.map((row, i) => (
          <ManagerCard key={row.id} row={row} place={i} />
        ))}
        {top3.length === 0 && !isLoading && (
          <p className="col-span-full py-6 text-center text-sm text-subtle">{t("lb.noManagers")}</p>
        )}
      </div>

      <div className="mt-6">
        <SectionCard title={t("lb.liveRanking2")}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-subtle">
                  <th className="py-2.5 pr-4">{t("lb.colManager")}</th>
                  <th className="px-4 py-2.5 text-center">{t("lb.colTotalLeads")}</th>
                  <th className="px-4 py-2.5 text-center">{t("lb.colWonLeads")}</th>
                  <th className="px-4 py-2.5 text-right">{t("lb.colRevenue")}</th>
                  <th className="px-4 py-2.5 text-center">{t("lb.colConversion")}</th>
                  <th className="px-4 py-2.5 text-center">{t("lb.colKpi")}</th>
                  <th className="px-4 py-2.5 text-right">{t("lb.colBonus")}</th>
                  <th className="py-2.5 pl-4 text-right">{t("lb.colTarget")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r, i) => (
                  <tr key={r.id}>
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-3">
                        <span className="w-7 shrink-0 text-right text-sm font-bold text-amber-500">
                          #{i + 1}
                        </span>
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-mint text-[11px] font-bold text-mint-foreground">
                          {r.initials}
                        </span>
                        <span className="truncate font-medium text-foreground">{r.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center tabular-nums">{r.totalLeads}</td>
                    <td className="px-4 py-3.5 text-center tabular-nums">{r.wonLeads}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-foreground">
                      {format(r.revenue)}
                    </td>
                    <td className="px-4 py-3.5 text-center tabular-nums">{pct(r.conversion)}</td>
                    <td className="px-4 py-3.5 text-center tabular-nums text-primary">
                      {pct(r.kpiPercent)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-medium text-success">
                      {format(r.revenue * 0.05)}
                    </td>
                    <td className="py-3.5 pl-4">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              r.targetCompletion >= 100
                                ? "bg-success"
                                : r.targetCompletion >= 60
                                  ? "bg-warning"
                                  : "bg-destructive",
                            )}
                            style={{ width: `${Math.min(100, r.targetCompletion)}%` }}
                          />
                        </div>
                        <span
                          className={cn(
                            "w-12 shrink-0 text-right tabular-nums font-semibold",
                            r.targetCompletion >= 100
                              ? "text-success"
                              : r.targetCompletion >= 60
                                ? "text-warning"
                                : "text-destructive",
                          )}
                        >
                          {pct(r.targetCompletion)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-sm text-subtle">
                      {t("lb.noManagers")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SectionCard
          title={t("lb.topStrengths")}
          description={t("lb.aiInsightsDesc")}
          actions={
            <button
              type="button"
              onClick={generateTopSummary}
              disabled={topBusy || top3.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-mint px-3 py-1.5 text-xs font-semibold text-mint-foreground transition-colors hover:bg-mint-border disabled:opacity-50"
            >
              {topBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <TrendingUp className="h-3.5 w-3.5" />
              )}
              {t("common.generate")}
            </button>
          }
        >
          {topSummary ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{topSummary}</p>
          ) : (
            <p className="flex items-center gap-2 text-sm text-subtle">
              <Sparkles className="h-4 w-4" /> {t("lb.aiPlaceholder")}
            </p>
          )}
        </SectionCard>

        <SectionCard
          title={t("lb.bottomWeaknesses")}
          description={t("lb.aiInsightsDesc")}
          actions={
            <button
              type="button"
              onClick={generateBottomSummary}
              disabled={bottomBusy || bottom3.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/15 disabled:opacity-50"
            >
              {bottomBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              {t("common.generate")}
            </button>
          }
        >
          {bottomSummary ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{bottomSummary}</p>
          ) : (
            <p className="flex items-center gap-2 text-sm text-subtle">
              <Sparkles className="h-4 w-4" /> {t("lb.aiPlaceholder")}
            </p>
          )}
        </SectionCard>
      </div>
    </>
  );
}
