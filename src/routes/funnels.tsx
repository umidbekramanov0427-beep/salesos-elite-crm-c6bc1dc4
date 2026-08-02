import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, SectionCard, StatCard, Pill } from "@/components/layout/Primitives";
import { FUNNEL_STAGES, LEADS, currency } from "@/lib/mock-data";

export const Route = createFileRoute("/funnels")({
  head: () => ({
    meta: [
      { title: "Funnels — SalesOS Elite" },
      { name: "description", content: "Pipeline visualization, stage conversion, average stage duration, won and lost deals." },
      { property: "og:title", content: "Funnels — SalesOS Elite" },
      { property: "og:description", content: "Pipeline visualization and stage conversion analysis." },
    ],
  }),
  component: Funnels,
});

function Funnels() {
  const max = FUNNEL_STAGES[0].count;
  return (
    <>
      <PageHeader title="Funnels" description="How value moves through the pipeline, stage by stage." />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Leads in funnel" value="1,240" delta={6.4} hint="this month" tone="mint" />
        <StatCard label="Lead → Won" value="5.7%" delta={0.8} hint="conversion" />
        <StatCard label="Avg cycle" value="25.7 days" delta={-3.1} hint="new lead to close" />
        <StatCard label="Lost value" value={currency(318400)} delta={-4.2} hint="last 30 days" />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <SectionCard title="Pipeline funnel" description="Volume and value per stage" className="xl:col-span-2">
          <div className="space-y-5">
            {FUNNEL_STAGES.map((s) => (
              <div key={s.stage}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{s.stage}</span>
                  <span className="text-muted-foreground">
                    {s.count} deals · {currency(s.value)}
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
                <p className="mt-1.5 text-xs text-subtle">Average {s.avgDays} days in stage</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Recent movement" description="Stage transitions in the last 72h">
          <ul className="space-y-5">
            {LEADS.map((l) => (
              <li key={l.id}>
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium">{l.company}</p>
                  <Pill tone={l.stage === "Won" ? "success" : l.stage === "Lost" ? "danger" : "info"}>{l.stage}</Pill>
                </div>
                <p className="mt-1 text-xs text-subtle">
                  {l.previousStage} → {l.stage} · {l.owner} · {l.updated}
                </p>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </>
  );
}
