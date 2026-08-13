import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Filter, GripVertical, Loader2, Search } from "lucide-react";
import { PageHeader, SectionCard, StatCard, Pill } from "@/components/layout/Primitives";
import { currency } from "@/lib/mock-data";
import { useCrmLeads } from "@/hooks/use-crm-data";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/crm-stages")({
  head: () => ({
    meta: [
      { title: "CRM Stages — SalesOS Elite" },
      {
        name: "description",
        content:
          "Complete lead list with current stage, previous stage, movement history, filters and bulk actions.",
      },
      { property: "og:title", content: "CRM Stages — SalesOS Elite" },
      {
        property: "og:description",
        content: "Complete lead list with stage history and bulk actions.",
      },
    ],
  }),
  component: CrmStages,
});

function CrmStages() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const { rows: leads, leads: rawLeads, stages, isLoading } = useCrmLeads();

  const rows = useMemo(() => {
    const q = query.toLowerCase();
    return leads.filter(
      (l) => !q || [l.company, l.name, l.owner, l.stage].some((v) => v.toLowerCase().includes(q)),
    );
  }, [leads, query]);

  const now = Date.now();
  const movedThisWeek = rawLeads.filter(
    (l) => now - new Date(l.updated_at).getTime() < 7 * 86400000,
  ).length;
  const stalled = rawLeads.filter(
    (l) => now - new Date(l.updated_at).getTime() >= 7 * 86400000,
  ).length;
  const openValue = leads.reduce((s, l) => s + l.expectedRevenue, 0);

  return (
    <>
      <PageHeader title={t("stages.title")} description={t("stages.desc")} />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("stages.totalLeads")}
          value={String(leads.length)}
          hint={t("stages.allStages")}
          tone="mint"
        />
        <StatCard
          label={t("stages.recentlyUpdated")}
          value={String(movedThisWeek)}
          hint={t("stages.last7Days")}
        />
        <StatCard
          label={t("stages.stalled")}
          value={String(stalled)}
          hint={t("stages.needsAttention")}
        />
        <StatCard label={t("stages.openValue")} value={currency(openValue)} />
      </div>

      <div className="mt-8">
        <SectionCard
          title={t("stages.allLeads")}
          actions={
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("stages.searchPlaceholder")}
                  className="h-10 w-52 rounded-xl border border-border bg-surface pl-9 pr-3 text-sm outline-none placeholder:text-subtle focus:border-primary/40"
                />
              </div>
              <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium text-muted-foreground hover:bg-accent">
                <Filter className="h-4 w-4" /> {t("stages.filters")}
              </button>
            </div>
          }
        >
          {isLoading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("stages.loading")}
            </div>
          )}
          {!isLoading && rows.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("stages.empty")}</p>
          )}
          {rows.length > 0 && (
            <div className="-m-6 overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-subtle">
                    <th className="px-6 py-3 font-medium">{t("stages.colLead")}</th>
                    <th className="px-6 py-3 font-medium">{t("stages.colContact")}</th>
                    <th className="px-6 py-3 font-medium">{t("stages.colCurrentStage")}</th>
                    <th className="px-6 py-3 font-medium">{t("stages.colOwner")}</th>
                    <th className="px-6 py-3 font-medium">{t("stages.colValue")}</th>
                    <th className="px-6 py-3 font-medium">{t("stages.colUpdated")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((l) => (
                    <tr
                      key={l.id}
                      className="border-b border-border last:border-0 transition-colors hover:bg-surface"
                    >
                      <td className="px-6 py-4">
                        <p className="font-medium text-foreground">{l.company || l.name}</p>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{l.name}</td>
                      <td className="px-6 py-4">
                        <Pill
                          tone={
                            l.stage === "Won" ? "success" : l.stage === "Lost" ? "danger" : "info"
                          }
                        >
                          {l.stage}
                        </Pill>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{l.owner}</td>
                      <td className="px-6 py-4 font-medium">{currency(l.expectedRevenue)}</td>
                      <td className="px-6 py-4 text-subtle">{l.updated}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-8">
        <SectionCard title={t("stages.config")} description={t("stages.configDesc")}>
          <ul className="space-y-2">
            {stages.map((s, i) => {
              const count = leads.filter((l) => l.stageId === s.id).length;
              return (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-subtle" />
                    <span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{s.name}</p>
                      <p className="text-xs text-subtle">
                        {t("stages.positionInfo", {
                          pos: i + 1,
                          prob: s.probability,
                          count,
                        })}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      </div>
    </>
  );
}
