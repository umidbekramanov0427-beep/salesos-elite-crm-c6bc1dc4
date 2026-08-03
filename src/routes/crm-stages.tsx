import { createFileRoute } from "@tanstack/react-router";
import { Filter, GripVertical, Search } from "lucide-react";
import { PageHeader, SectionCard, StatCard, Pill } from "@/components/layout/Primitives";
import { LEADS, currency } from "@/lib/mock-data";
import { PIPELINE_STAGES, LEAD_PERMISSIONS } from "@/lib/crm-data";

export const Route = createFileRoute("/crm-stages")({
  head: () => ({
    meta: [
      { title: "CRM Stages — SalesOS Elite" },
      { name: "description", content: "Complete lead list with current stage, previous stage, movement history, filters and bulk actions." },
      { property: "og:title", content: "CRM Stages — SalesOS Elite" },
      { property: "og:description", content: "Complete lead list with stage history and bulk actions." },
    ],
  }),
  component: CrmStages,
});

function CrmStages() {
  return (
    <>
      <PageHeader title="CRM Stages" description="The full lead register with stage movement and history." />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total leads" value="1,240" hint="all stages" tone="mint" />
        <StatCard label="Moved this week" value="186" delta={8.9} hint="stage transitions" />
        <StatCard label="Stalled 7+ days" value="42" delta={-6.2} hint="needs attention" />
        <StatCard label="Open value" value={currency(1042000)} delta={7.6} />
      </div>

      <div className="mt-8">
        <SectionCard
          title="All leads"
          actions={
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                <input
                  placeholder="Search leads"
                  className="h-10 w-52 rounded-xl border border-border bg-surface pl-9 pr-3 text-sm outline-none placeholder:text-subtle focus:border-primary/40"
                />
              </div>
              <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium text-muted-foreground hover:bg-accent">
                <Filter className="h-4 w-4" /> Filters
              </button>
            </div>
          }
        >
          <div className="-m-6 overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-subtle">
                  <th className="px-6 py-3 font-medium">Lead</th>
                  <th className="px-6 py-3 font-medium">Contact</th>
                  <th className="px-6 py-3 font-medium">Previous</th>
                  <th className="px-6 py-3 font-medium">Current stage</th>
                  <th className="px-6 py-3 font-medium">Owner</th>
                  <th className="px-6 py-3 font-medium">Value</th>
                  <th className="px-6 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {LEADS.map((l) => (
                  <tr key={l.id} className="border-b border-border last:border-0 transition-colors hover:bg-surface">
                    <td className="px-6 py-4">
                      <p className="font-medium text-foreground">{l.company}</p>
                      <p className="text-xs text-subtle">{l.id}</p>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{l.contact}</td>
                    <td className="px-6 py-4 text-subtle">{l.previousStage}</td>
                    <td className="px-6 py-4">
                      <Pill tone={l.stage === "Won" ? "success" : l.stage === "Lost" ? "danger" : "info"}>{l.stage}</Pill>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{l.owner}</td>
                    <td className="px-6 py-4 font-medium">{currency(l.value)}</td>
                    <td className="px-6 py-4 text-subtle">{l.updated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Stage configuration"
          description="Create, rename, reorder, color and automate every stage"
          actions={
            <button className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Add stage</button>
          }
        >
          <ul className="space-y-2">
            {PIPELINE_STAGES.map((s, i) => (
              <li key={s.id} className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-subtle" />
                  <span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{s.name}</p>
                    <p className="text-xs text-subtle">
                      Position {i + 1} · probability {s.probability}% · {s.limit ? `limit ${s.limit}` : "no limit"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button className="rounded-lg border border-border px-2.5 py-1 font-medium text-muted-foreground hover:bg-accent">Rules</button>
                  <button className="rounded-lg border border-border px-2.5 py-1 font-medium text-muted-foreground hover:bg-accent">Rename</button>
                  <button className="rounded-lg border border-border px-2.5 py-1 font-medium text-destructive hover:bg-accent">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Lead permissions" description="Every action respects role permissions">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-subtle">
                  <th className="py-3 font-medium">Action</th>
                  <th className="py-3 font-medium">Admin</th>
                  <th className="py-3 font-medium">Manager</th>
                  <th className="py-3 font-medium">Sales rep</th>
                </tr>
              </thead>
              <tbody>
                {LEAD_PERMISSIONS.map((p) => (
                  <tr key={p.action} className="border-b border-border last:border-0">
                    <td className="py-3 font-medium text-foreground">{p.action}</td>
                    {[p.admin, p.manager, p.rep].map((v, i) => (
                      <td key={i} className="py-3">
                        <Pill tone={v ? "success" : "neutral"}>{v ? "Allowed" : "Denied"}</Pill>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </>
  );
}
