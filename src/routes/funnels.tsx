import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { PageHeader, SectionCard, StatCard, Pill } from "@/components/layout/Primitives";
import { currency } from "@/lib/mock-data";
import { useCrmLeads } from "@/hooks/use-crm-data";

export const Route = createFileRoute("/funnels")({
  head: () => ({
    meta: [
      { title: "Funnels — SalesOS Elite" },
      {
        name: "description",
        content: "Pipeline visualization and stage conversion, computed from live CRM data.",
      },
      { property: "og:title", content: "Funnels — SalesOS Elite" },
      {
        property: "og:description",
        content: "Pipeline visualization and stage conversion analysis.",
      },
    ],
  }),
  component: Funnels,
});

function Funnels() {
  const { rows: leads, leads: rawLeads, stages, isLoading } = useCrmLeads();

  const funnel = useMemo(() => {
    const nonTerminal = stages.filter((s) => !s.is_lost).sort((a, b) => a.position - b.position);
    const base = nonTerminal[0]
      ? leads.filter((l) => l.stageId === nonTerminal[0]!.id).length || leads.length
      : leads.length || 1;
    return nonTerminal.map((s) => {
      const inStage = leads.filter((l) => l.stageId === s.id);
      return {
        stage: s.name,
        count: inStage.length,
        value: inStage.reduce((sum, l) => sum + l.expectedRevenue, 0),
        conversion: base ? Math.round((inStage.length / base) * 1000) / 10 : 0,
      };
    });
  }, [stages, leads]);

  const max = Math.max(1, ...funnel.map((s) => s.count));
  const wonStage = stages.find((s) => s.is_won);
  const lostStage = stages.find((s) => s.is_lost);
  const wonCount = wonStage ? leads.filter((l) => l.stageId === wonStage.id).length : 0;
  const lostValue = lostStage
    ? leads.filter((l) => l.stageId === lostStage.id).reduce((s, l) => s + l.expectedRevenue, 0)
    : 0;
  const conversionRate = leads.length ? Math.round((wonCount / leads.length) * 1000) / 10 : 0;

  const recentOrder = [...rawLeads]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 8);
  const recent = recentOrder.map((r) => leads.find((l) => l.id === r.id)!).filter(Boolean);

  return (
    <>
      <PageHeader
        title="Funnels"
        description="How value moves through the pipeline, stage by stage."
      />

      {isLoading && (
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Leads in funnel"
          value={String(leads.length)}
          hint="all stages"
          tone="mint"
        />
        <StatCard label="Lead → Won" value={`${conversionRate}%`} hint="conversion" />
        <StatCard label="Won deals" value={String(wonCount)} />
        <StatCard label="Lost value" value={currency(lostValue)} />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <SectionCard
          title="Pipeline funnel"
          description="Volume and value per stage"
          className="xl:col-span-2"
        >
          <div className="space-y-5">
            {funnel.map((s) => (
              <div key={s.stage}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{s.stage}</span>
                  <span className="text-muted-foreground">
                    {s.count} leads · {currency(s.value)}
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
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Recently updated" description="Most recently touched leads">
          {recent.length === 0 && <p className="text-sm text-subtle">No leads yet.</p>}
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
