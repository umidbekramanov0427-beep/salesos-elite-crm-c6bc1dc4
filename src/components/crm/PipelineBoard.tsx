import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalLink, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { TagEditor } from "@/components/crm/tag-editor";
import { useCurrency } from "@/lib/currency";
import { useI18n } from "@/lib/i18n";
import { cn, stageColorProps } from "@/lib/utils";
import {
  useAmoCrmLink,
  usePermission,
  useUpdateLead,
  type CrmLeadView,
  type StageRow,
} from "@/hooks/use-crm-data";

// The AmoCRM drag-and-drop Kanban board -- previously the whole /crm/pipeline
// page, now embedded as one of Funnels' 3 lead views (the other two being
// list and gallery, in LeadFilterBar). Takes the funnel's already-filtered
// lead set (same one the list/gallery views render) plus the full stage
// list, and renders only the columns belonging to this funnel.
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

export function PipelineBoard({
  funnel,
  leads,
  stages,
}: {
  funnel: string;
  leads: CrmLeadView[];
  stages: StageRow[];
}) {
  const { t } = useI18n();
  const { format } = useCurrency();
  const updateLead = useUpdateLead();
  const getAmoLink = useAmoCrmLink();
  const canMoveDeals = usePermission("Move deals");
  const canViewRevenue = usePermission("View revenue");

  const visibleStages = useMemo(
    () => stages.filter((s) => (s.pipeline_name || "Direct Sales") === funnel),
    [stages, funnel],
  );

  const [board, setBoard] = useState<Record<string, string[]>>({});
  const [dragged, setDragged] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  useEffect(() => {
    const next: Record<string, string[]> = {};
    for (const s of visibleStages)
      next[s.id] = leads.filter((l) => l.stageId === s.id).map((l) => l.id);
    setBoard(next);
  }, [visibleStages, leads]);

  async function move(stageId: string) {
    if (!dragged || !canMoveDeals) return;
    const leadId = dragged;
    const previousBoard = board;
    setBoard((b) => {
      const next: Record<string, string[]> = {};
      for (const k of Object.keys(b)) next[k] = (b[k] ?? []).filter((id) => id !== leadId);
      next[stageId] = [leadId, ...(next[stageId] ?? [])];
      return next;
    });
    setDragged(null);
    setOver(null);
    try {
      await updateLead.mutateAsync({ id: leadId, patch: { stage_id: stageId } });
    } catch (err) {
      // Optimistic move failed server-side (RLS denial, network blip) --
      // used to just silently leave the card parked in the new column
      // forever with no error and no way to tell the move never persisted.
      setBoard(previousBoard);
      toast.error(err instanceof Error ? err.message : t("pipeline.moveFailed"));
    }
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex min-w-max gap-5">
        {visibleStages.map((s) => {
          const ids = board[s.id] ?? [];
          const items = ids.map((id) => leads.find((l) => l.id === id)!).filter(Boolean);
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
              onDrop={() => void move(s.id)}
              className={cn(
                "flex w-[300px] shrink-0 flex-col rounded-2xl border p-3 shadow-soft transition-colors",
                over === s.id ? "border-primary/50 bg-mint ring-2 ring-primary/20" : tint.className,
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
                <span className="text-xs font-medium text-muted-foreground">{s.probability}%</span>
              </header>
              {canViewRevenue && (
                <p className="px-2 py-2 text-xs font-medium text-subtle">
                  {format(value)} {t("pipeline.expected")}
                </p>
              )}

              <div className="space-y-2.5">
                {items.map((l) => {
                  const amoLink = getAmoLink(l.amocrmId);
                  return (
                    <article
                      key={l.id}
                      draggable={canMoveDeals}
                      onDragStart={() => setDragged(l.id)}
                      className={cn(
                        "group relative cursor-grab rounded-xl border border-border bg-background p-3 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card active:cursor-grabbing",
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
                          {t("leadFilter.openInAmoCrm")} <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to="/crm/leads/$leadId"
                          params={{ leadId: l.id }}
                          search={{ from: "funnels" }}
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

                      {canViewRevenue && (
                        <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
                          <span className="text-sm font-semibold text-foreground">
                            {format(l.expectedRevenue)}
                          </span>
                        </div>
                      )}
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
  );
}
