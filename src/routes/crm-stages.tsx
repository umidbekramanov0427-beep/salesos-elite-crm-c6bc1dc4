import { createFileRoute } from "@tanstack/react-router";
import { Filter, Search } from "lucide-react";
import { PageHeader, SectionCard, StatCard, Pill } from "@/components/layout/Primitives";
import { LEADS, currency } from "@/lib/mock-data";

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
    </>
  );
}
