import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowLeft, ChevronRight, Loader2, Workflow } from "lucide-react";
import { PageHeader, SectionCard, StatCard, Pill } from "@/components/layout/Primitives";
import { useCurrency } from "@/lib/currency";
import { useI18n } from "@/lib/i18n";
import { useCrmLeads, type CrmLeadView, type LeadRow } from "@/hooks/use-crm-data";

export const Route = createFileRoute("/funnels")({
  validateSearch: (search: Record<string, unknown>): { funnel?: string | undefined } => ({
    funnel: typeof search["funnel"] === "string" ? search["funnel"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Funnels — SalesOS Elite" },
      {
        name: "description",
        content: "Every sales funnel in the CRM, with a dedicated stage-by-stage analysis view.",
      },
      { property: "og:title", content: "Funnels — SalesOS Elite" },
      {
        property: "og:description",
        content: "Pipeline visualization and stage conversion analysis, per funnel.",
      },
    ],
  }),
  component: Funnels,
});

const funnelOf = (l: CrmLeadView) => l.funnel || "Direct Sales";

function Funnels() {
  const { funnel: funnelParam } = Route.useSearch();
  const { rows: leads, leads: rawLeads, isLoading } = useCrmLeads();

  if (isLoading && leads.length === 0) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  return funnelParam ? (
    <FunnelDetail name={funnelParam} leads={leads} rawLeads={rawLeads} isLoading={isLoading} />
  ) : (
    <FunnelList leads={leads} isLoading={isLoading} />
  );
}

function FunnelList({ leads, isLoading }: { leads: CrmLeadView[]; isLoading: boolean }) {
  const { t } = useI18n();
  const { format } = useCurrency();

  const funnels = useMemo(() => {
    const map = new Map<string, CrmLeadView[]>();
    for (const l of leads) {
      const key = funnelOf(l);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    }
    return Array.from(map.entries())
      .map(([name, items]) => {
        const value = items.reduce((sum, l) => sum + l.expectedRevenue, 0);
        const won = items.filter((l) => l.stage === "Won").length;
        const conversion = items.length ? Math.round((won / items.length) * 1000) / 10 : 0;
        return { name, count: items.length, value, won, conversion };
      })
      .sort((a, b) => b.count - a.count);
  }, [leads]);

  const maxCount = Math.max(1, ...funnels.map((f) => f.count));

  return (
    <>
      <PageHeader title={t("funnels.title")} description={t("funnels.navigatorDesc")} />

      {isLoading && (
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {funnels.map((f) => (
          <Link
            key={f.name}
            to="/funnels"
            search={{ funnel: f.name }}
            className="group block rounded-2xl border border-border bg-surface p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mint text-mint-foreground">
                  <Workflow className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{f.name}</p>
                  <p className="text-xs text-subtle">
                    {t("funnels.leadsCount", { count: f.count })}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>

            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/80"
                style={{ width: `${Math.max(6, (f.count / maxCount) * 100)}%` }}
              />
            </div>

            <div className="mt-4 flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">{format(f.value)}</span>
              <span className="font-semibold text-success">
                {f.conversion}% {t("funnels.conversion")}
              </span>
            </div>
          </Link>
        ))}

        {funnels.length === 0 && !isLoading && (
          <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
            {t("funnels.noLeads")}
          </p>
        )}
      </div>
    </>
  );
}

function FunnelDetail({
  name,
  leads: allLeads,
  rawLeads,
  isLoading,
}: {
  name: string;
  leads: CrmLeadView[];
  rawLeads: LeadRow[];
  isLoading: boolean;
}) {
  const { t } = useI18n();
  const { format } = useCurrency();
  const leads = useMemo(() => allLeads.filter((l) => funnelOf(l) === name), [allLeads, name]);
  const rawById = useMemo(() => new Map(rawLeads.map((r) => [r.id, r])), [rawLeads]);

  const stageOrder = useMemo(() => {
    const seen = new Map<string, number>();
    for (const l of leads) if (!seen.has(l.stage)) seen.set(l.stage, seen.size);
    return Array.from(seen.keys());
  }, [leads]);

  const funnel = useMemo(() => {
    const base = leads.length || 1;
    return stageOrder.map((stage) => {
      const inStage = leads.filter((l) => l.stage === stage);
      return {
        stage,
        count: inStage.length,
        value: inStage.reduce((sum, l) => sum + l.expectedRevenue, 0),
        conversion: Math.round((inStage.length / base) * 1000) / 10,
      };
    });
  }, [stageOrder, leads]);

  const max = Math.max(1, ...funnel.map((s) => s.count));
  const wonCount = leads.filter((l) => l.stage === "Won").length;
  const lostValue = leads
    .filter((l) => l.stage === "Lost")
    .reduce((s, l) => s + l.expectedRevenue, 0);
  const conversionRate = leads.length ? Math.round((wonCount / leads.length) * 1000) / 10 : 0;

  const recent = [...leads]
    .sort((a, b) => {
      const at = rawById.get(a.id)?.updated_at ?? "";
      const bt = rawById.get(b.id)?.updated_at ?? "";
      return new Date(bt).getTime() - new Date(at).getTime();
    })
    .slice(0, 8);

  return (
    <>
      <Link
        to="/funnels"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> {t("funnels.backToFunnels")}
      </Link>

      <PageHeader title={name} description={t("funnels.desc")} />

      {isLoading && (
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("funnels.leadsInFunnel")}
          value={String(leads.length)}
          hint={t("funnels.allStages")}
          tone="mint"
        />
        <StatCard
          label={t("funnels.leadToWon")}
          value={`${conversionRate}%`}
          hint={t("funnels.conversion")}
        />
        <StatCard label={t("funnels.wonDeals")} value={String(wonCount)} />
        <StatCard label={t("funnels.lostValue")} value={format(lostValue)} />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <SectionCard
          title={t("funnels.pipelineFunnel")}
          description={t("funnels.volumeValue")}
          className="xl:col-span-2"
        >
          <div className="space-y-5">
            {funnel.map((s) => (
              <Link
                key={s.stage}
                to="/crm/leads"
                search={{ stage: s.stage }}
                className="block rounded-xl transition-opacity hover:opacity-90"
              >
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{s.stage}</span>
                  <span className="text-muted-foreground">
                    {t("funnels.leadsCount", { count: s.count })} · {format(s.value)}
                  </span>
                </div>
                <div className="h-9 w-full overflow-hidden rounded-xl bg-surface">
                  <div
                    className="flex h-full items-center justify-end rounded-xl bg-primary/85 px-3 text-xs font-semibold text-primary-foreground transition-all duration-500"
                    style={{ width: `${Math.max(12, (s.count / max) * 100)}%` }}
                  >
                    {s.conversion}%
                  </div>
                </div>
              </Link>
            ))}
            {funnel.length === 0 && <p className="text-sm text-subtle">{t("funnels.noLeads")}</p>}
          </div>
        </SectionCard>

        <SectionCard title={t("funnels.recentlyUpdated")} description={t("funnels.mostRecent")}>
          {recent.length === 0 && <p className="text-sm text-subtle">{t("funnels.noLeads")}</p>}
          <ul className="space-y-5">
            {recent.map((l) => (
              <li key={l.id}>
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium">{l.company || l.name}</p>
                  <Pill
                    tone={l.stage === "Won" ? "success" : l.stage === "Lost" ? "danger" : "info"}
                  >
                    {l.stage}
                  </Pill>
                </div>
                <p className="mt-1 text-xs text-subtle">
                  {l.owner} · {l.updated}
                </p>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </>
  );
}
