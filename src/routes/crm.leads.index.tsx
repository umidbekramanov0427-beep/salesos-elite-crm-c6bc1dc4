import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Filter, Pin, Search, Star, Upload, ChevronDown } from "lucide-react";
import { PageHeader, SectionCard, StatCard, Pill } from "@/components/layout/Primitives";
import { CRM_LEADS, SAVED_VIEWS } from "@/lib/crm-data";
import { currency } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/crm/leads/")({
  head: () => ({
    meta: [
      { title: "Leads — SalesOS Elite CRM" },
      { name: "description", content: "Enterprise lead register with saved views, advanced filters, scoring, bulk actions, import and export." },
      { property: "og:title", content: "Leads — SalesOS Elite CRM" },
      { property: "og:description", content: "Search, filter, group and act on every lead in one workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeadsPage,
});

const tempTone = (t: string) => (t === "Hot" ? "danger" : t === "Warm" ? "warning" : "info") as const;

function LeadsPage() {
  const [query, setQuery] = useState("");
  const [view, setView] = useState(SAVED_VIEWS[0]);
  const [selected, setSelected] = useState<string[]>([]);
  const [sortDesc, setSortDesc] = useState(true);

  const rows = useMemo(() => {
    const q = query.toLowerCase();
    return CRM_LEADS.filter(
      (l) =>
        !q ||
        [l.name, l.company, l.email, l.id, l.owner, l.stage].some((v) => v.toLowerCase().includes(q)),
    ).sort((a, b) => (sortDesc ? b.score - a.score : a.score - b.score));
  }, [query, sortDesc]);

  const allSelected = selected.length > 0 && selected.length === rows.length;

  return (
    <>
      <PageHeader
        title="Leads"
        description="Every lead, contact point and next action in one register."
        actions={
          <>
            <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium text-muted-foreground hover:bg-accent">
              <Upload className="h-4 w-4" /> Import
            </button>
            <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium text-muted-foreground hover:bg-accent">
              <Download className="h-4 w-4" /> Export
            </button>
            <button className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90">
              New lead
            </button>
          </>
        }
      />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active leads" value={String(CRM_LEADS.length * 207)} hint="all funnels" tone="mint" />
        <StatCard label="Hot leads" value="184" delta={11.2} hint="score ≥ 80" />
        <StatCard label="Avg. lead score" value="69" delta={3.4} />
        <StatCard label="Open value" value={currency(345800)} delta={7.6} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {SAVED_VIEWS.map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors",
              view === v ? "border-primary/40 bg-mint text-mint-foreground" : "border-border text-muted-foreground hover:bg-accent",
            )}
          >
            {v === SAVED_VIEWS[0] ? <Star className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            {v}
          </button>
        ))}
      </div>

      <div className="mt-6">
        <SectionCard
          title={view}
          description={`${rows.length} of ${CRM_LEADS.length} leads · grouped by stage priority`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search leads, companies, owners"
                  className="h-10 w-64 rounded-xl border border-border bg-surface pl-9 pr-3 text-sm outline-none placeholder:text-subtle focus:border-primary/40"
                />
              </div>
              <button
                onClick={() => setSortDesc((s) => !s)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-medium text-muted-foreground hover:bg-accent"
              >
                Score <ChevronDown className={cn("h-4 w-4 transition-transform", !sortDesc && "rotate-180")} />
              </button>
              <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-medium text-muted-foreground hover:bg-accent">
                <Filter className="h-4 w-4" /> Filters
              </button>
            </div>
          }
        >
          {selected.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-mint-border bg-mint px-4 py-3 text-sm">
              <span className="font-semibold text-mint-foreground">{selected.length} selected</span>
              {["Assign owner", "Change stage", "Add tag", "Merge", "Export", "Delete"].map((a) => (
                <button key={a} className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent">
                  {a}
                </button>
              ))}
            </div>
          )}

          <div className="-m-6 overflow-x-auto">
            <table className="w-full min-w-[1200px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-subtle">
                  <th className="px-6 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all leads"
                      checked={allSelected}
                      onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])}
                    />
                  </th>
                  {["Lead", "Company", "Stage", "Owner", "Score", "Temp", "Expected", "Next follow up", "Updated"].map((h) => (
                    <th key={h} className="px-6 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id} className="border-b border-border last:border-0 transition-colors hover:bg-surface">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        aria-label={`Select ${l.name}`}
                        checked={selected.includes(l.id)}
                        onChange={(e) =>
                          setSelected((s) => (e.target.checked ? [...s, l.id] : s.filter((x) => x !== l.id)))
                        }
                      />
                    </td>
                    <td className="px-6 py-4">
                      <Link to="/crm/leads/$leadId" params={{ leadId: l.id }} className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint text-xs font-semibold text-mint-foreground">
                          {l.initials}
                        </span>
                        <span>
                          <span className="block font-medium text-foreground hover:text-primary">{l.name}</span>
                          <span className="block text-xs text-subtle">{l.id} · {l.position}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{l.company}</td>
                    <td className="px-6 py-4">
                      <Pill tone={l.stage === "Won" ? "success" : "info"}>{l.stage}</Pill>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{l.owner}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-success" style={{ width: `${l.score}%` }} />
                        </div>
                        <span className="text-xs font-semibold">{l.score}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4"><Pill tone={tempTone(l.temperature)}>{l.temperature}</Pill></td>
                    <td className="px-6 py-4 font-medium">{currency(l.expectedRevenue)}</td>
                    <td className="px-6 py-4 text-muted-foreground">{l.nextFollowUp}</td>
                    <td className="px-6 py-4 text-subtle">{l.updated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="-mx-6 -mb-6 mt-6 flex items-center justify-between border-t border-border px-6 pt-4 text-xs text-subtle">
            <span>Showing 1–{rows.length} of 1,240</span>
            <div className="flex items-center gap-1">
              {["Previous", "1", "2", "3", "Next"].map((p) => (
                <button key={p} className="rounded-lg border border-border px-2.5 py-1 font-medium text-muted-foreground hover:bg-accent">
                  {p}
                </button>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>
    </>
  );
}
