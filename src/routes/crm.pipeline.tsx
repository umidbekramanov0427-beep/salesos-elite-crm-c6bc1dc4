import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GripVertical, Loader2 } from "lucide-react";
import { PageHeader, Pill } from "@/components/layout/Primitives";
import { currency } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useCrmLeads, useUpdateLead } from "@/hooks/use-crm-data";

export const Route = createFileRoute("/crm/pipeline")({
  head: () => ({
    meta: [
      { title: "Pipeline — SalesOS Elite CRM" },
      {
        name: "description",
        content:
          "Kanban pipeline with drag & drop stage movement, stage limits, colors, won, lost and archived deals.",
      },
      { property: "og:title", content: "Pipeline — SalesOS Elite CRM" },
      {
        property: "og:description",
        content: "Drag & drop Kanban board for the whole revenue pipeline.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PipelinePage,
});

function PipelinePage() {
  const { rows: leads, stages, isLoading } = useCrmLeads();
  const updateLead = useUpdateLead();

  const [board, setBoard] = useState<Record<string, string[]>>({});
  const [dragged, setDragged] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  useEffect(() => {
    const next: Record<string, string[]> = {};
    for (const s of stages) next[s.id] = leads.filter((l) => l.stageId === s.id).map((l) => l.id);
    setBoard(next);
  }, [stages, leads]);

  const move = (stageId: string) => {
    if (!dragged) return;
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
        title="Pipeline"
        description="Drag deals between stages — the stage change is saved instantly."
      />

      {isLoading && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading pipeline…
        </div>
      )}

      <div className="overflow-x-auto pb-4">
        <div className="flex min-w-max gap-4">
          {stages.map((s) => {
            const ids = board[s.id] ?? [];
            const items = ids.map((id) => leads.find((l) => l.id === id)!).filter(Boolean);
            const value = items.reduce((sum, l) => sum + l.expectedRevenue, 0);
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
                  "w-[300px] shrink-0 rounded-2xl border bg-surface p-3 transition-colors",
                  over === s.id ? "border-primary/50 bg-mint" : "border-border",
                )}
              >
                <header className="flex items-center justify-between px-2 pb-3">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2.5 w-2.5 rounded-full", s.color)} />
                    <p className="text-sm font-semibold text-foreground">{s.name}</p>
                    <span className="text-xs text-subtle">{items.length}</span>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    {s.probability}%
                  </span>
                </header>
                <p className="px-2 pb-3 text-xs text-subtle">{currency(value)} expected</p>

                <div className="space-y-2">
                  {items.map((l) => (
                    <article
                      key={l.id}
                      draggable
                      onDragStart={() => setDragged(l.id)}
                      className="group cursor-grab rounded-xl border border-border bg-background p-3 shadow-soft active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to="/crm/leads/$leadId"
                          params={{ leadId: l.id }}
                          className="text-sm font-medium text-foreground hover:text-primary"
                        >
                          {l.company || l.name}
                        </Link>
                        <GripVertical className="h-4 w-4 shrink-0 text-subtle opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                      <p className="mt-1 text-xs text-subtle">
                        {l.name} · {l.owner}
                      </p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-sm font-semibold">{currency(l.expectedRevenue)}</span>
                        <Pill
                          tone={
                            l.temperature === "Hot"
                              ? "danger"
                              : l.temperature === "Warm"
                                ? "warning"
                                : "info"
                          }
                        >
                          {l.temperature}
                        </Pill>
                      </div>
                    </article>
                  ))}
                  {items.length === 0 && (
                    <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-subtle">
                      Drop a deal here
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
