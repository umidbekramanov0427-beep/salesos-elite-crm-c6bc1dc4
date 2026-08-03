import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { PageHeader, SectionCard, StatCard, Pill } from "@/components/layout/Primitives";
import { DEALS } from "@/lib/crm-data";
import { currency } from "@/lib/mock-data";

export const Route = createFileRoute("/crm/deals")({
  head: () => ({
    meta: [
      { title: "Deals — SalesOS Elite CRM" },
      { name: "description", content: "Deal register with value, currency, probability, close date, products, discount, tax and owner." },
      { property: "og:title", content: "Deals — SalesOS Elite CRM" },
      { property: "og:description", content: "Track every deal from qualification to signature." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DealsPage,
});

function DealsPage() {
  const weighted = DEALS.reduce((s, d) => s + (d.value * d.probability) / 100, 0);
  return (
    <>
      <PageHeader title="Deals" description="Commercial reality of the pipeline — value, probability and timing." />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open deals" value={String(DEALS.length)} hint="this quarter" tone="mint" />
        <StatCard label="Total value" value={currency(DEALS.reduce((s, d) => s + d.value, 0))} delta={9.3} />
        <StatCard label="Weighted forecast" value={currency(Math.round(weighted))} delta={6.8} />
        <StatCard label="Avg. deal size" value={currency(Math.round(DEALS.reduce((s, d) => s + d.value, 0) / DEALS.length))} delta={2.4} />
      </div>

      <div className="mt-8">
        <SectionCard
          title="All deals"
          actions={
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <input
                placeholder="Search deals"
                className="h-10 w-56 rounded-xl border border-border bg-surface pl-9 pr-3 text-sm outline-none placeholder:text-subtle focus:border-primary/40"
              />
            </div>
          }
        >
          <div className="-m-6 overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-subtle">
                  {["Deal", "Company", "Value", "Probability", "Close date", "Stage", "Pipeline", "Products", "Owner"].map((h) => (
                    <th key={h} className="px-6 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DEALS.map((d) => (
                  <tr key={d.id} className="border-b border-border last:border-0 transition-colors hover:bg-surface">
                    <td className="px-6 py-4">
                      <p className="font-medium text-foreground">{d.name}</p>
                      <p className="text-xs text-subtle">{d.id} · disc. {d.discount}% · tax {d.tax}%</p>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{d.company}</td>
                    <td className="px-6 py-4 font-medium">{currency(d.value)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-success" style={{ width: `${d.probability}%` }} />
                        </div>
                        <span className="text-xs font-semibold">{d.probability}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{d.closeDate}</td>
                    <td className="px-6 py-4"><Pill tone={d.stage === "Won" ? "success" : "info"}>{d.stage}</Pill></td>
                    <td className="px-6 py-4 text-muted-foreground">{d.pipeline}</td>
                    <td className="px-6 py-4 text-muted-foreground">{d.products}</td>
                    <td className="px-6 py-4 text-muted-foreground">{d.owner}</td>
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
