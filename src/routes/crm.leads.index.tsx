import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Download,
  Filter,
  Pin,
  Plus,
  Search,
  Star,
  Upload,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { PageHeader, SectionCard, StatCard, Pill } from "@/components/layout/Primitives";
import { SAVED_VIEWS } from "@/lib/crm-data";
import { useCurrency } from "@/lib/currency";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useCrmLeads } from "@/hooks/use-crm-data";
import { NewLeadDialog } from "@/components/crm/quick-create";

export const Route = createFileRoute("/crm/leads/")({
  validateSearch: (search: Record<string, unknown>): { stage?: string | undefined } => ({
    stage: typeof search["stage"] === "string" ? search["stage"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Leads — SalesOS Elite CRM" },
      {
        name: "description",
        content:
          "Enterprise lead register with saved views, advanced filters, scoring, bulk actions, import and export.",
      },
      { property: "og:title", content: "Leads — SalesOS Elite CRM" },
      {
        property: "og:description",
        content: "Search, filter, group and act on every lead in one workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeadsPage,
});

const tempTone = (t: string): "danger" | "warning" | "info" =>
  t === "Hot" ? "danger" : t === "Warm" ? "warning" : "info";

function LeadsPage() {
  const { t } = useI18n();
  const { format } = useCurrency();
  const { stage: stageFilter } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<string>(SAVED_VIEWS[0] ?? "All leads");
  const [selected, setSelected] = useState<string[]>([]);
  const [sortDesc, setSortDesc] = useState(true);
  const { rows: allLeads, isLoading } = useCrmLeads();

  const rows = useMemo(() => {
    const q = query.toLowerCase();
    return allLeads
      .filter((l) => !stageFilter || l.stage === stageFilter)
      .filter(
        (l) =>
          !q ||
          [l.name, l.company, l.email, l.id, l.owner, l.stage].some((v) =>
            v.toLowerCase().includes(q),
          ),
      )
      .sort((a, b) => (sortDesc ? b.score - a.score : a.score - b.score));
  }, [allLeads, query, sortDesc, stageFilter]);

  const hotCount = allLeads.filter((l) => l.score >= 80).length;
  const avgScore = allLeads.length
    ? Math.round(allLeads.reduce((s, l) => s + l.score, 0) / allLeads.length)
    : 0;
  const openValue = allLeads.reduce((s, l) => s + l.expectedRevenue, 0);

  const allSelected = selected.length > 0 && selected.length === rows.length;

  return (
    <>
      <PageHeader
        title={t("leads.title")}
        description={t("leads.desc")}
        actions={
          <>
            <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium text-muted-foreground hover:bg-accent">
              <Upload className="h-4 w-4" /> {t("leads.import")}
            </button>
            <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium text-muted-foreground hover:bg-accent">
              <Download className="h-4 w-4" /> {t("leads.export")}
            </button>
            <NewLeadDialog
              trigger={
                <button className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90">
                  <Plus className="h-4 w-4" /> {t("leads.newLead")}
                </button>
              }
            />
          </>
        }
      />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("leads.activeLeads")}
          value={String(allLeads.length)}
          hint={t("leads.allFunnels")}
          tone="mint"
        />
        <StatCard
          label={t("leads.hotLeads")}
          value={String(hotCount)}
          hint={t("leads.scoreHint")}
        />
        <StatCard label={t("leads.avgScore")} value={String(avgScore)} />
        <StatCard label={t("leads.openValue")} value={format(openValue)} />
      </div>

      {isLoading && (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("leads.loading")}
        </div>
      )}

      {stageFilter && (
        <div className="mt-6 flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-mint px-3 py-1.5 text-xs font-medium text-mint-foreground">
            {t("leads.stageFilter", { stage: stageFilter })}
            <button
              onClick={() => void navigate({ search: {} })}
              className="rounded-full p-0.5 hover:bg-background/40"
              aria-label={t("leads.clearFilter")}
            >
              ×
            </button>
          </span>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {SAVED_VIEWS.map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors",
              view === v
                ? "border-primary/40 bg-mint text-mint-foreground"
                : "border-border text-muted-foreground hover:bg-accent",
            )}
          >
            {v === SAVED_VIEWS[0] ? (
              <Star className="h-3.5 w-3.5" />
            ) : (
              <Pin className="h-3.5 w-3.5" />
            )}
            {v}
          </button>
        ))}
      </div>

      <div className="mt-6">
        <SectionCard
          title={view}
          description={t("leads.groupDesc", { shown: rows.length, total: allLeads.length })}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("leads.searchPlaceholder")}
                  className="h-10 w-64 rounded-xl border border-border bg-surface pl-9 pr-3 text-sm outline-none placeholder:text-subtle focus:border-primary/40"
                />
              </div>
              <button
                onClick={() => setSortDesc((s) => !s)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-medium text-muted-foreground hover:bg-accent"
              >
                {t("leads.score")}{" "}
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform", !sortDesc && "rotate-180")}
                />
              </button>
              <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-medium text-muted-foreground hover:bg-accent">
                <Filter className="h-4 w-4" /> {t("leads.filters")}
              </button>
            </div>
          }
        >
          {selected.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-mint-border bg-mint px-4 py-3 text-sm">
              <span className="font-semibold text-mint-foreground">
                {t("leads.selectedCount", { count: selected.length })}
              </span>
              {[
                t("leads.bulkAssignOwner"),
                t("leads.bulkChangeStage"),
                t("leads.bulkAddTag"),
                t("leads.bulkMerge"),
                t("leads.export"),
                t("leads.bulkDelete"),
              ].map((a) => (
                <button
                  key={a}
                  className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent"
                >
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
                      aria-label={t("leads.selectAll")}
                      checked={allSelected}
                      onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])}
                    />
                  </th>
                  {[
                    t("leads.colLead"),
                    t("leads.colCompany"),
                    t("leads.colStage"),
                    t("leads.colOwner"),
                    t("leads.colScore"),
                    t("leads.colTemp"),
                    t("leads.colExpected"),
                    t("leads.colNextFollowUp"),
                    t("leads.colUpdated"),
                  ].map((h) => (
                    <th key={h} className="px-6 py-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr
                    key={l.id}
                    className="border-b border-border last:border-0 transition-colors hover:bg-surface"
                  >
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        aria-label={t("leads.selectOne", { name: l.name })}
                        checked={selected.includes(l.id)}
                        onChange={(e) =>
                          setSelected((s) =>
                            e.target.checked ? [...s, l.id] : s.filter((x) => x !== l.id),
                          )
                        }
                      />
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        to="/crm/leads/$leadId"
                        params={{ leadId: l.id }}
                        className="flex items-center gap-3"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint text-xs font-semibold text-mint-foreground">
                          {l.initials}
                        </span>
                        <span>
                          <span className="block font-medium text-foreground hover:text-primary">
                            {l.name}
                          </span>
                          <span className="block text-xs text-subtle">
                            {l.id} · {l.position}
                          </span>
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
                          <div
                            className="h-full rounded-full bg-success"
                            style={{ width: `${l.score}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold">{l.score}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Pill tone={tempTone(l.temperature)}>{l.temperature}</Pill>
                    </td>
                    <td className="px-6 py-4 font-medium">{format(l.expectedRevenue)}</td>
                    <td className="px-6 py-4 text-muted-foreground">{l.nextFollowUp}</td>
                    <td className="px-6 py-4 text-subtle">{l.updated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rows.length === 0 && !isLoading && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("leads.emptyState")}
            </p>
          )}

          <div className="-mx-6 -mb-6 mt-6 flex items-center justify-between border-t border-border px-6 pt-4 text-xs text-subtle">
            <span>{t("leads.showingCount", { shown: rows.length, total: allLeads.length })}</span>
          </div>
        </SectionCard>
      </div>
    </>
  );
}
