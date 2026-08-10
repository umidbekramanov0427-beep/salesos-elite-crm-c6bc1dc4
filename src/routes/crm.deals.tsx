import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import {
  PageHeader,
  SectionCard,
  StatCard,
  Pill,
  ExportButton,
} from "@/components/layout/Primitives";
import { currency } from "@/lib/mock-data";
import { useDealsView } from "@/hooks/use-crm-data";
import { NewDealDialog } from "@/components/crm/quick-create";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/crm/deals")({
  head: () => ({
    meta: [
      { title: "Deals — SalesOS Elite CRM" },
      {
        name: "description",
        content:
          "Deal register with value, currency, probability, close date, products, discount, tax and owner.",
      },
      { property: "og:title", content: "Deals — SalesOS Elite CRM" },
      { property: "og:description", content: "Track every deal from qualification to signature." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DealsPage,
});

function DealsPage() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const { rows: deals, isLoading } = useDealsView();

  const rows = useMemo(() => {
    const q = query.toLowerCase();
    return deals.filter(
      (d) => !q || [d.name, d.company, d.owner, d.stage].some((v) => v.toLowerCase().includes(q)),
    );
  }, [deals, query]);

  const openDeals = deals.filter((d) => d.status === "open");
  const totalValue = deals.reduce((s, d) => s + d.value, 0);
  const weighted = deals.reduce((s, d) => s + (d.value * d.probability) / 100, 0);
  const avgSize = deals.length ? Math.round(totalValue / deals.length) : 0;

  return (
    <>
      <PageHeader
        title={t("deals.title")}
        description={t("deals.desc")}
        actions={
          <>
            <ExportButton
              filename="deals"
              rows={rows.map((d) => ({
                Name: d.name,
                Company: d.company,
                Owner: d.owner,
                Stage: d.stage,
                Value: d.value,
                Currency: d.currency,
                Probability: d.probability,
                CloseDate: d.closeDate,
                Status: d.status,
              }))}
            />
            <NewDealDialog
              trigger={
                <button className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90">
                  <Plus className="h-4 w-4" /> {t("deals.new")}
                </button>
              }
            />
          </>
        }
      />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("deals.openDeals")}
          value={String(openDeals.length)}
          hint={t("deals.thisQuarter")}
          tone="mint"
        />
        <StatCard label={t("deals.totalValue")} value={currency(totalValue)} />
        <StatCard label={t("deals.weightedForecast")} value={currency(Math.round(weighted))} />
        <StatCard label={t("deals.avgSize")} value={currency(avgSize)} />
      </div>

      <div className="mt-8">
        <SectionCard
          title={t("deals.all")}
          actions={
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("deals.searchPlaceholder")}
                className="h-10 w-56 rounded-xl border border-border bg-surface pl-9 pr-3 text-sm outline-none placeholder:text-subtle focus:border-primary/40"
              />
            </div>
          }
        >
          {isLoading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("deals.loading")}
            </div>
          )}
          {!isLoading && rows.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("deals.empty")}</p>
          )}
          {rows.length > 0 && (
            <div className="-m-6 overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-subtle">
                    {[
                      t("deals.colDeal"),
                      t("deals.colCompany"),
                      t("deals.colValue"),
                      t("deals.colProbability"),
                      t("deals.colCloseDate"),
                      t("deals.colStage"),
                      t("deals.colPipeline"),
                      t("deals.colProducts"),
                      t("deals.colOwner"),
                    ].map((h) => (
                      <th key={h} className="px-6 py-3 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((d) => (
                    <tr
                      key={d.id}
                      className="border-b border-border last:border-0 transition-colors hover:bg-surface"
                    >
                      <td className="px-6 py-4">
                        <p className="font-medium text-foreground">{d.name}</p>
                        <p className="text-xs text-subtle">
                          {t("deals.discTax", { discount: d.discount, tax: d.tax })}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{d.company || "—"}</td>
                      <td className="px-6 py-4 font-medium">{currency(d.value)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-success"
                              style={{ width: `${d.probability}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold">{d.probability}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{d.closeDate}</td>
                      <td className="px-6 py-4">
                        <Pill tone={d.stage === "Won" ? "success" : "info"}>{d.stage || "—"}</Pill>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{d.pipeline}</td>
                      <td className="px-6 py-4 text-muted-foreground">{d.products}</td>
                      <td className="px-6 py-4 text-muted-foreground">{d.owner}</td>
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
