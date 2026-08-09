import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Filter, GripVertical, Loader2, Search } from "lucide-react";
import { PageHeader, SectionCard, StatCard, Pill } from "@/components/layout/Primitives";
import { currency } from "@/lib/mock-data";
import { LEAD_PERMISSIONS } from "@/lib/crm-data";
import { useCrmLeads } from "@/hooks/use-crm-data";

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
      <PageHeader
        title="CRM Stages"
        description="The full lead register with stage movement and history."
      />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total leads" value={String(leads.length)} hint="all stages" tone="mint" />
        <StatCard label="Recently updated" value={String(movedThisWeek)} hint="last 7 days" />
        <StatCard label="Stalled 7+ days" value={String(stalled)} hint="needs attention" />
        <StatCard label="Open value" value={currency(openValue)} />
      </div>

      <div className="mt-8">
        <SectionCard
          title="All leads"
          actions={
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
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
          {isLoading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading leads…
            </div>
          )}
          {!isLoading && rows.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No leads match this search.
            </p>
          )}
          {rows.length > 0 && (
            <div className="-m-6 overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-subtle">
                    <th className="px-6 py-3 font-medium">Lead</th>
                    <th className="px-6 py-3 font-medium">Contact</th>
                    <th className="px-6 py-3 font-medium">Current stage</th>
                    <th className="px-6 py-3 font-medium">Owner</th>
                    <th className="px-6 py-3 font-medium">Value</th>
                    <th className="px-6 py-3 font-medium">Updated</th>
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

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Stage configuration"
          description="Order, color and probability of every pipeline stage"
        >
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
                        Position {i + 1} · probability {s.probability}% · {count} lead
                        {count === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
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
