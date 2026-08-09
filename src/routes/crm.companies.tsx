import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Globe, Loader2, Plus, Search } from "lucide-react";
import { PageHeader, SectionCard, StatCard, Pill } from "@/components/layout/Primitives";
import { currency } from "@/lib/mock-data";
import { useCompaniesView } from "@/hooks/use-crm-data";
import { NewCompanyDialog } from "@/components/crm/quick-create";

export const Route = createFileRoute("/crm/companies")({
  head: () => ({
    meta: [
      { title: "Companies — SalesOS Elite CRM" },
      {
        name: "description",
        content:
          "Company profiles with industry, headcount, revenue, owner, contacts, deals, activities and files.",
      },
      { property: "og:title", content: "Companies — SalesOS Elite CRM" },
      {
        property: "og:description",
        content: "Account profiles linked to contacts, deals and invoices.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompaniesPage,
});

function CompaniesPage() {
  const [query, setQuery] = useState("");
  const { rows: companies, isLoading } = useCompaniesView();

  const rows = useMemo(() => {
    const q = query.toLowerCase();
    return companies.filter(
      (c) => !q || [c.name, c.industry, c.city, c.owner].some((v) => v.toLowerCase().includes(q)),
    );
  }, [companies, query]);

  const enterpriseCount = companies.filter((c) => c.revenue >= 50_000_000).length;
  const openValue = companies.reduce((s, c) => s + c.openValue, 0);
  const avgContacts = companies.length
    ? (companies.reduce((s, c) => s + c.contacts, 0) / companies.length).toFixed(1)
    : "0";

  return (
    <>
      <PageHeader
        title="Companies"
        description="Accounts with every contact, deal and document attached."
        actions={
          <NewCompanyDialog
            trigger={
              <button className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90">
                <Plus className="h-4 w-4" /> New company
              </button>
            }
          />
        }
      />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Companies"
          value={String(companies.length)}
          hint="active accounts"
          tone="mint"
        />
        <StatCard label="Enterprise accounts" value={String(enterpriseCount)} />
        <StatCard label="Open account value" value={currency(openValue)} />
        <StatCard label="Avg. contacts per account" value={avgContacts} />
      </div>

      <div className="mt-8">
        <SectionCard
          title="Account list"
          actions={
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search companies"
                className="h-10 w-56 rounded-xl border border-border bg-surface pl-9 pr-3 text-sm outline-none placeholder:text-subtle focus:border-primary/40"
              />
            </div>
          }
        >
          {isLoading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading companies…
            </div>
          )}
          {!isLoading && rows.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No companies yet. Click “New company” to add your first account.
            </p>
          )}
          {rows.length > 0 && (
            <div className="-m-6 overflow-x-auto">
              <table className="w-full min-w-[1000px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-subtle">
                    {[
                      "Company",
                      "Industry",
                      "Employees",
                      "Annual revenue",
                      "Owner",
                      "Contacts",
                      "Deals",
                      "Open value",
                    ].map((h) => (
                      <th key={h} className="px-6 py-3 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-border last:border-0 transition-colors hover:bg-surface"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint text-xs font-semibold text-mint-foreground">
                            {c.initials}
                          </span>
                          <div>
                            <p className="font-medium text-foreground">{c.name}</p>
                            <p className="flex items-center gap-1 text-xs text-subtle">
                              <Globe className="h-3 w-3" /> {c.website || "—"} · {c.city || "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{c.industry || "—"}</td>
                      <td className="px-6 py-4 text-muted-foreground">{c.employees || "—"}</td>
                      <td className="px-6 py-4 text-muted-foreground">{currency(c.revenue)}</td>
                      <td className="px-6 py-4 text-muted-foreground">{c.owner}</td>
                      <td className="px-6 py-4">
                        <Pill>{c.contacts}</Pill>
                      </td>
                      <td className="px-6 py-4">
                        <Pill tone="info">{c.deals}</Pill>
                      </td>
                      <td className="px-6 py-4 font-medium">{currency(c.openValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}
