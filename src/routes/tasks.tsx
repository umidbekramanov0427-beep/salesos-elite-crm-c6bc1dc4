import { createFileRoute } from "@tanstack/react-router";
import { useState, type DragEvent } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionCard, Pill } from "@/components/layout/Primitives";
import { useTasksView, useUpdateTask, type TaskRow } from "@/hooks/use-crm-data";
import { NewTaskDialog } from "@/components/crm/quick-create";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "Important Tasks — SalesOS Elite" },
      {
        name: "description",
        content: "Admin-created tasks with assignees, priority, deadlines and progress.",
      },
      { property: "og:title", content: "Important Tasks — SalesOS Elite" },
      {
        property: "og:description",
        content: "Company-wide task board with priority, deadlines and progress.",
      },
    ],
  }),
  component: Tasks,
});

const COLUMNS: TaskRow["status"][] = ["Todo", "In progress", "Review", "Done"];

function Tasks() {
  const { rows: tasks, isLoading } = useTasksView();
  const updateTask = useUpdateTask();
  const [dragOverCol, setDragOverCol] = useState<TaskRow["status"] | null>(null);

  async function moveTask(id: string, status: TaskRow["status"]) {
    try {
      await updateTask.mutateAsync({ id, patch: { status } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't move this task");
    }
  }

  function onDragStart(e: DragEvent, id: string) {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDrop(e: DragEvent, col: TaskRow["status"]) {
    e.preventDefault();
    setDragOverCol(null);
    const id = e.dataTransfer.getData("text/plain");
    if (id) void moveTask(id, col);
  }

  return (
    <>
      <PageHeader
        title="Important Tasks"
        description="Company-level work assigned by admins, tracked to completion."
        actions={
          <NewTaskDialog
            trigger={
              <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition-colors hover:bg-primary/90">
                <Plus className="h-4 w-4" /> New task
              </button>
            }
          />
        }
      />

      {isLoading && (
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading tasks…
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = tasks.filter((t) => t.status === col && !t.leadId);
          return (
            <div
              key={col}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverCol(col);
              }}
              onDragLeave={() => setDragOverCol((c) => (c === col ? null : c))}
              onDrop={(e) => onDrop(e, col)}
              className={cn(
                "rounded-3xl transition-colors",
                dragOverCol === col && "ring-2 ring-primary/50",
              )}
            >
              <SectionCard title={col} description={`${items.length} tasks`}>
                <div className="min-h-[80px] space-y-4">
                  {items.length === 0 && <p className="text-sm text-subtle">Nothing here yet.</p>}
                  {items.map((t) => (
                    <article
                      key={t.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, t.id)}
                      className="cursor-grab rounded-xl border border-border bg-surface p-4 transition-shadow hover:shadow-card active:cursor-grabbing"
                    >
                      <div className="flex items-center justify-between">
                        <Pill
                          tone={
                            t.priority === "Urgent"
                              ? "danger"
                              : t.priority === "High"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {t.priority}
                        </Pill>
                      </div>
                      <p className="mt-2 text-sm font-medium leading-snug text-foreground">
                        {t.title}
                      </p>
                      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full rounded-full bg-success"
                          style={{ width: `${t.progress}%` }}
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-subtle">
                        <span>
                          {t.assignee.split(" ")[0]} · {t.due}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </SectionCard>
            </div>
          );
        })}
      </div>
    </>
  );
}
