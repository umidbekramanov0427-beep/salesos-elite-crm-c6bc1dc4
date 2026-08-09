import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowLeft, ChevronRight, Loader2, Workflow } from "lucide-react";
import { PageHeader, SectionCard, StatCard, Pill } from "@/components/layout/Primitives";
import { TagChip } from "@/components/crm/tag-editor";
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

const tempTone = (t: CrmLeadView["temperature"]) =>
  t === "Hot" ? "danger" : t === "Warm" ? "warning" : "info";

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

function HeatBar({ leads }: { leads: CrmLeadView[] }) {
  const { t } = useI18n();
  const hot = leads.filter((l) => l.temperature === "Hot").length;
  const warm = leads.filter((l) => l.temperature === "Warm").length;
  const cold = leads.filter((l) => l.temperature === "Cold").length;
  const total = Math.max(1, hot + warm + cold);

  return (
    <div className="mt-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-subtle">
        {t("funnels.heat")}
      </p>
      <div className="mt-1.5 flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {hot > 0 && (
          <div className="h-full bg-destructive" style={{ width: `${(hot / total) * 100}%` }} />
        )}
        {warm > 0 && (
          <div className="h-full bg-warning" style={{ width: `${(warm / total) * 100}%` }} />
        )}
        {cold > 0 && (
          <div className="h-full bg-primary" style={{ width: `${(cold / total) * 100}%` }} />
        )}
      </div>
    </div>
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
        return { name, items, count: items.length, value, won, conversion };
      })
      .sort((a, b) => b.count - a.count);
  }, [leads]);

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
            className="group block rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">
                <Workflow className="h-3 w-3" /> CRM
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>

            <div className="mt-3 flex items-end justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-bold text-foreground">{f.name}</p>
              <div className="shrink-0 text-right">
                <p className="text-2xl font-bold leading-none text-foreground">{f.count}</p>
                <p className="mt-1 text-[11px] text-subtle">{t("funnels.openLeads")}</p>
              </div>
            </div>

            <HeatBar leads={f.items} />

            <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
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

function LeadGalleryCard({ lead }: { lead: CrmLeadView }) {
  const { t } = useI18n();
  const { format } = useCurrency();
  return (
    <Link
      to="/crm/leads/$leadId"
      params={{ leadId: lead.id }}
      className="group block rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card"
    >
      <div className="flex items-center justify-between gap-2">
        <Pill tone={tempTone(lead.temperature)}>{lead.temperature}</Pill>
        <Pill tone={lead.stage === "Won" ? "success" : lead.stage === "Lost" ? "danger" : "info"}>
          {lead.stage}
        </Pill>
      </div>
      <p className="mt-3 truncate text-sm font-semibold text-foreground">
        {lead.company || lead.name}
      </p>
      <p className="truncate text-xs text-subtle">{lead.owner}</p>
      {lead.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {lead.tags.slice(0, 3).map((tag) => (
            <TagChip key={tag} tag={tag} size="xs" />
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <span className="text-sm font-semibold text-foreground">
          {format(lead.expectedRevenue)}
        </span>
        <span className="text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
          {t("funnels.viewLead")} →
        </span>
      </div>
    </Link>
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

  const gallery = useMemo(
    () =>
      [...leads].sort((a, b) => {
        const at = rawById.get(a.id)?.updated_at ?? "";
        const bt = rawById.get(b.id)?.updated_at ?? "";
        return new Date(bt).getTime() - new Date(at).getTime();
      }),
    [leads, rawById],
  );

  const wonCount = leads.filter((l) => l.stage === "Won").length;
  const lostValue = leads
    .filter((l) => l.stage === "Lost")
    .reduce((s, l) => s + l.expectedRevenue, 0);
  const conversionRate = leads.length ? Math.round((wonCount / leads.length) * 1000) / 10 : 0;

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

      <div className="mt-8">
        <SectionCard title={t("funnels.gallery")} description={t("funnels.galleryDesc")}>
          {gallery.length === 0 ? (
            <p className="py-10 text-center text-sm text-subtle">{t("funnels.noLeads")}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {gallery.map((lead) => (
                <LeadGalleryCard key={lead.id} lead={lead} />
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}
