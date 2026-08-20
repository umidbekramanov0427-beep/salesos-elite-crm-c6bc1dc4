import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ExternalLink, GripVertical, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/Primitives";
import { TagEditor } from "@/components/crm/tag-editor";
import { LeadFilterBar, filterLeads, type LeadFilterState } from "@/components/crm/LeadFilterBar";
import { AsOfDatePicker, AsOfBanner } from "@/components/filters/AsOfDatePicker";
import { DateRangeFilter, type DateFilterValue } from "@/components/leaderboard/DateRangeFilter";
import { useCurrency } from "@/lib/currency";
import { useI18n } from "@/lib/i18n";
import { cn, stageColorProps } from "@/lib/utils";
import {
  useAmoCrmLink,
  useAsOfSnapshot,
  useCrmLeads,
  useEnabledFunnelNames,
  usePipelineBoardLeads,
  usePipelineStagesRaw,
  useProfilesRaw,
  useUpdateLead,
  type LeadRow,
} from "@/hooks/use-crm-data";
import { PermissionGate } from "@/components/PermissionGate";

export const Route = createFileRoute("/crm/pipeline")({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    funnel?: string | undefined;
    owner?: string | undefined;
    stage?: string | undefined;
    tags?: string | undefined;
    q?: string | undefined;
    min?: string | undefined;
    max?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
    label?: string | undefined;
  } => ({
    funnel: typeof search["funnel"] === "string" ? search["funnel"] : undefined,
    owner: typeof search["owner"] === "string" ? search["owner"] : undefined,
    stage: typeof search["stage"] === "string" ? search["stage"] : undefined,
    tags: typeof search["tags"] === "string" ? search["tags"] : undefined,
    q: typeof search["q"] === "string" ? search["q"] : undefined,
    min: typeof search["min"] === "string" ? search["min"] : undefined,
    max: typeof search["max"] === "string" ? search["max"] : undefined,
    from: typeof search["from"] === "string" ? search["from"] : undefined,
    to: typeof search["to"] === "string" ? search["to"] : undefined,
    label: typeof search["label"] === "string" ? search["label"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "AmoCRM — SalesOS Elite CRM" },
      {
        name: "description",
        content:
          "Kanban pipeline with drag & drop stage movement, stage limits, colors, won, lost and archived deals.",
      },
      { property: "og:title", content: "AmoCRM — SalesOS Elite CRM" },
      {
        property: "og:description",
        content: "Drag & drop Kanban board for the whole revenue pipeline.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PipelinePageGated,
});

function PipelinePageGated() {
  return (
    <PermissionGate action="View pipeline">
      <PipelinePage />
    </PermissionGate>
  );
}

function stageTint(s: { is_won: boolean; is_lost: boolean; color: string }): {
  className?: string;
  style?: CSSProperties;
} {
  if (s.is_won) return { className: "bg-success/10 border-success/30" };
  if (s.is_lost) return { className: "bg-destructive/10 border-destructive/30" };
  // s.color is a real AmoCRM hex for synced stages, a Tailwind class for
  // hand-created ones (see stageColorProps) -- hex needs an inline alpha
  // tint instead of Tailwind's "/5" opacity-modifier syntax, which only
  // works on class names.
  if (s.color.startsWith("#")) {
    // AmoCRM's own stage colors run the gamut from muted to eye-searing
    // neon, and this column background sits behind everything on the
    // board (lead cards, text) all day -- keep it faint enough to read as
    // "a tint" rather than "a highlighter", regardless of how saturated
    // the source hex is.
    return { style: { backgroundColor: `${s.color}0A`, borderColor: `${s.color}26` } };
  }
  return { className: `${s.color}/5 border-border` };
}

function PipelinePage() {
  const { t } = useI18n();
  const { format } = useCurrency();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const funnelParam = search.funnel;
  const [asOfDate, setAsOfDate] = useState<Date | null>(null);
  const asOfSnapshot = useAsOfSnapshot<LeadRow>("leads", asOfDate);
  const { data: allStages } = usePipelineStagesRaw();
  const enabledFunnels = useEnabledFunnelNames();
  const funnelNames = useMemo(() => {
    const set = new Set<string>();
    for (const s of allStages ?? []) {
      const name = s.pipeline_name || "Direct Sales";
      if (enabledFunnels && !enabledFunnels.has(name)) continue;
      set.add(name);
    }
    return Array.from(set).sort();
  }, [allStages, enabledFunnels]);

  // "As of date" reconstructs the whole org's leads from the audit trail
  // (see useAsOfSnapshot) -- there's no way to scope that to one funnel
  // server-side, so it only pays that org-wide cost when a user opts into
  // it, falling back to useCrmLeads' full join. The default, common path
  // (no as-of date) stays on usePipelineBoardLeads, which only fetches
  // this one funnel's leads.
  const boardResult = usePipelineBoardLeads(asOfDate ? null : (funnelParam ?? null));
  const asOfResult = useCrmLeads(asOfDate ? (asOfSnapshot.data ?? []) : undefined, {
    enabled: !!asOfDate,
  });
  const stages = boardResult.stages;
  const effectiveLeads = asOfDate
    ? asOfResult.rows.filter((l) => l.funnel === funnelParam)
    : boardResult.rows;
  const isLoading = asOfDate
    ? asOfResult.isLoading || asOfSnapshot.isLoading
    : boardResult.isLoading;
  const updateLead = useUpdateLead();
  const { data: profiles } = useProfilesRaw();
  const getAmoLink = useAmoCrmLink();

  const dateFilter: DateFilterValue = useMemo(
    () => ({
      from: search.from ? new Date(search.from) : null,
      to: search.to ? new Date(search.to) : null,
      label: search.label ?? t("lb.presetAll"),
    }),
    [search.from, search.to, search.label, t],
  );
  function setDateFilter(v: DateFilterValue) {
    void navigate({
      to: "/crm/pipeline",
      search: (prev) => ({
        ...prev,
        from: v.from ? v.from.toISOString() : undefined,
        to: v.to ? v.to.toISOString() : undefined,
        label: v.label || undefined,
      }),
      replace: true,
    });
  }
  const dateScopedLeads = useMemo(() => {
    if (!dateFilter.from && !dateFilter.to) return effectiveLeads;
    return effectiveLeads.filter((l) => {
      const created = new Date(l.createdAtIso).getTime();
      if (dateFilter.from && created < dateFilter.from.getTime()) return false;
      if (dateFilter.to && created > dateFilter.to.getTime()) return false;
      return true;
    });
  }, [effectiveLeads, dateFilter]);

  // Filters live in the URL, not local state, so refresh/back-navigation
  // returns you to exactly the same filtered view instead of resetting it.
  const filters: LeadFilterState = useMemo(
    () => ({
      funnel: funnelParam ?? null,
      ownerId: search.owner ?? null,
      tags: search.tags ? search.tags.split(",").filter(Boolean) : [],
      stageId: search.stage ?? null,
      search: search.q ?? "",
      amount: {
        min: search.min !== undefined ? Number(search.min) : null,
        max: search.max !== undefined ? Number(search.max) : null,
      },
    }),
    [funnelParam, search.owner, search.tags, search.stage, search.q, search.min, search.max],
  );
  const filteredLeads = useMemo(
    () => filterLeads(dateScopedLeads, { ...filters, funnel: null }),
    [dateScopedLeads, filters],
  );
  const tagOptions = useMemo(() => {
    const set = new Set<string>();
    for (const l of dateScopedLeads) for (const tag of l.tags) set.add(tag);
    return Array.from(set).sort();
  }, [dateScopedLeads]);
  const ownerOptions = useMemo(() => {
    const ownerIds = new Set(dateScopedLeads.map((l) => l.ownerId).filter(Boolean));
    return (profiles ?? []).filter((p) => ownerIds.has(p.id));
  }, [dateScopedLeads, profiles]);
  const visibleStages = useMemo(
    () => stages.filter((s) => (s.pipeline_name || "Direct Sales") === funnelParam),
    [stages, funnelParam],
  );

  const [board, setBoard] = useState<Record<string, string[]>>({});
  const [dragged, setDragged] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  useEffect(() => {
    const next: Record<string, string[]> = {};
    for (const s of visibleStages)
      next[s.id] = filteredLeads.filter((l) => l.stageId === s.id).map((l) => l.id);
    setBoard(next);
  }, [visibleStages, filteredLeads]);

  const move = (stageId: string) => {
    if (!dragged || asOfDate) return;
    setBoard((b) => {
      const next: Record<string, string[]> = {};
      for (const k of Object.keys(b)) next[k] = (b[k] ?? []).filter((id) => id !== dragged);
      next[stageId] = [dragged, ...(next[stageId] ?? [])];
      return next;
    });
    updateLead.mutate({ id: dragged, patch: { stage_id: stageId } });
    setDragged(null);
    setOver(null);
  };

  return (
    <>
      <PageHeader
        title={funnelParam || t("pipeline.title")}
        description={funnelParam ? t("pipeline.desc") : t("pipeline.pickFunnelDesc")}
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <LeadFilterBar
          value={filters}
          onChange={(next) => {
            void navigate({
              to: "/crm/pipeline",
              search: (prev) => ({
                ...prev,
                funnel: next.funnel ?? undefined,
                owner: next.ownerId ?? undefined,
                stage: next.stageId ?? undefined,
                tags: next.tags.length ? next.tags.join(",") : undefined,
                q: next.search || undefined,
                min: next.amount.min != null ? String(next.amount.min) : undefined,
                max: next.amount.max != null ? String(next.amount.max) : undefined,
              }),
              replace: true,
            });
          }}
          funnels={funnelNames}
          owners={ownerOptions}
          tags={tagOptions}
          stages={stages}
        />
        {funnelParam && <DateRangeFilter value={dateFilter} onChange={setDateFilter} />}
        {funnelParam && <AsOfDatePicker value={asOfDate} onChange={setAsOfDate} />}
      </div>

      {funnelParam && <AsOfBanner value={asOfDate} />}

      {!funnelParam && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t("pipeline.pickFunnelDesc")}
        </p>
      )}

      {funnelParam && isLoading && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("pipeline.loading")}
        </div>
      )}

      {funnelParam && (
        <div className="overflow-x-auto pb-4">
          <div className="flex min-w-max gap-5">
            {visibleStages.map((s) => {
              const ids = board[s.id] ?? [];
              const items = ids
                .map((id) => filteredLeads.find((l) => l.id === id)!)
                .filter(Boolean);
              const value = items.reduce((sum, l) => sum + l.expectedRevenue, 0);
              const tint = stageTint(s);
              const dot = stageColorProps(s.color);
              return (
                <section
                  key={s.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOver(s.id);
                  }}
                  onDragLeave={() => setOver((o) => (o === s.id ? null : o))}
                  onDrop={() => move(s.id)}
                  className={cn(
                    "flex w-[300px] shrink-0 flex-col rounded-2xl border p-3 shadow-soft transition-colors",
                    over === s.id
                      ? "border-primary/50 bg-mint ring-2 ring-primary/20"
                      : tint.className,
                  )}
                  style={over === s.id ? undefined : tint.style}
                >
                  <header className="flex items-center justify-between rounded-xl bg-background px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn("h-2.5 w-2.5 rounded-full", dot.className)}
                        style={dot.style}
                      />
                      <p className="text-sm font-semibold text-foreground">{s.name}</p>
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        {items.length}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {s.probability}%
                    </span>
                  </header>
                  <p className="px-2 py-2 text-xs font-medium text-subtle">
                    {format(value)} {t("pipeline.expected")}
                  </p>

                  <div className="space-y-2.5">
                    {items.map((l) => {
                      const amoLink = getAmoLink(l.amocrmId);
                      return (
                        <article
                          key={l.id}
                          draggable={!asOfDate}
                          onDragStart={() => setDragged(l.id)}
                          className={cn(
                            "group relative rounded-xl border border-border bg-background p-3 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card",
                            asOfDate ? "cursor-default" : "cursor-grab active:cursor-grabbing",
                            dragged === l.id && "opacity-50",
                          )}
                        >
                          {amoLink && (
                            <a
                              href={amoLink}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-foreground/90 px-1.5 py-0.5 text-[10px] font-bold text-background hover:opacity-80"
                            >
                              {t("leadFilter.openInAmoCrm")}{" "}
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                          <div className="flex items-start justify-between gap-2">
                            <Link
                              to="/crm/leads/$leadId"
                              params={{ leadId: l.id }}
                              search={{ from: "pipeline" }}
                              className="flex min-w-0 items-center gap-2"
                            >
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-mint text-[11px] font-semibold text-mint-foreground">
                                {l.initials}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium text-foreground hover:text-primary">
                                  {l.company || l.name}
                                </span>
                                <span className="block truncate text-xs text-subtle">
                                  {l.name} · {l.owner}
                                </span>
                              </span>
                            </Link>
                            <GripVertical className="h-4 w-4 shrink-0 text-subtle opacity-0 transition-opacity group-hover:opacity-100" />
                          </div>

                          <div className="mt-2.5">
                            <TagEditor leadId={l.id} tags={l.tags} />
                          </div>

                          <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
                            <span className="text-sm font-semibold text-foreground">
                              {format(l.expectedRevenue)}
                            </span>
                          </div>
                        </article>
                      );
                    })}
                    {items.length === 0 && (
                      <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-subtle">
                        {t("pipeline.dropHint")}
                      </p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
