import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Loader2, TrendingDown, Flame } from "lucide-react";
import { PageHeader, SectionCard, StatCard, Pill } from "@/components/layout/Primitives";
import { useCrmBase } from "@/hooks/use-crm-data";
import { useCurrency } from "@/lib/currency";
import { useI18n } from "@/lib/i18n";
import { PermissionGate } from "@/components/PermissionGate";

export const Route = createFileRoute("/lead-analytics")({
  head: () => ({
    meta: [
      { title: "Lead Analytics — SalesOS Elite" },
      {
        name: "description",
        content: "At-risk leads, hot leads close to closing, and lead conversion health.",
      },
    ],
  }),
  component: LeadAnalyticsGated,
});

function LeadAnalyticsGated() {
  return (
    <PermissionGate action="View leads">
      <LeadAnalytics />
    </PermissionGate>
  );
}

function LeadAnalytics() {
  const { t } = useI18n();
  const { format } = useCurrency();
  const { leads, stages, profiles, isLoading } = useCrmBase();

  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);
  const ownerById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  const active = useMemo(
    () =>
      leads.filter((l) => {
        const stage = l.stage_id ? stageById.get(l.stage_id) : undefined;
        return !stage || (!stage.is_won && !stage.is_lost);
      }),
    [leads, stageById],
  );

  const lost = useMemo(
    () =>
      leads
        .filter((l) => {
          const stage = l.stage_id ? stageById.get(l.stage_id) : undefined;
          return stage?.is_lost ?? false;
        })
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 8),
    [leads, stageById],
  );

  const hot = useMemo(
    () =>
      [...active]
        .filter((l) => {
          const stage = l.stage_id ? stageById.get(l.stage_id) : undefined;
          return (stage?.probability ?? 0) >= 60;
        })
        .sort((a, b) => Number(b.expected_revenue) - Number(a.expected_revenue))
        .slice(0, 8),
    [active, stageById],
  );

  const wonCount = leads.filter((l) => {
    const stage = l.stage_id ? stageById.get(l.stage_id) : undefined;
    return stage?.is_won ?? false;
  }).length;
  const closedCount =
    wonCount +
    leads.filter((l) => {
      const stage = l.stage_id ? stageById.get(l.stage_id) : undefined;
      return stage?.is_lost ?? false;
    }).length;
  const conversionRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0;

  const potentialValue = active.reduce((sum, l) => sum + Number(l.expected_revenue), 0);
  const avgScore =
    active.length > 0
      ? Math.round(active.reduce((sum, l) => sum + Number(l.score), 0) / active.length)
      : 0;

  function ownerName(ownerId: string | null) {
    if (!ownerId) return "—";
    return ownerById.get(ownerId)?.full_name ?? "—";
  }

  return (
    <>
      <PageHeader title={t("leadAnalytics.title")} description={t("leadAnalytics.desc")} />

      {isLoading && (
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("leadAnalytics.activeLeads")} value={String(active.length)} />
        <StatCard
          label={t("leadAnalytics.potentialValue")}
          value={format(potentialValue)}
          tone="mint"
        />
        <StatCard label={t("leadAnalytics.avgScore")} value={String(avgScore)} />
        <StatCard label={t("leadAnalytics.conversionRate")} value={`${conversionRate}%`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SectionCard title={t("leadAnalytics.lostTitle")} description={t("leadAnalytics.lostDesc")}>
          {lost.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("leadAnalytics.noLost")}
            </p>
          ) : (
            <div className="space-y-2">
              {lost.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{l.name}</p>
                    <p className="truncate text-xs text-subtle">{l.company_name}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-foreground">
                      {format(Number(l.expected_revenue))}
                    </p>
                    <p className="text-xs text-subtle">{ownerName(l.owner_id)}</p>
                  </div>
                  <Pill tone="danger">
                    <TrendingDown className="mr-1 inline h-3 w-3" />
                    {t("leadAnalytics.lost")}
                  </Pill>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title={t("leadAnalytics.hotTitle")} description={t("leadAnalytics.hotDesc")}>
          {hot.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("leadAnalytics.noHot")}
            </p>
          ) : (
            <div className="space-y-2">
              {hot.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{l.name}</p>
                    <p className="truncate text-xs text-subtle">{l.company_name}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-foreground">
                      {format(Number(l.expected_revenue))}
                    </p>
                    <p className="text-xs text-subtle">{ownerName(l.owner_id)}</p>
                  </div>
                  <Pill tone="success">
                    <Flame className="mr-1 inline h-3 w-3" />
                    {stageById.get(l.stage_id ?? "")?.name ?? "—"}
                  </Pill>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}
