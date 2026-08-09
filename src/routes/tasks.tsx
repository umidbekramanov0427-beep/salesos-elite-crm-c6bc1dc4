import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Plus } from "lucide-react";
import { PageHeader, SectionCard, Pill } from "@/components/layout/Primitives";
import { useTasksView } from "@/hooks/use-crm-data";
import { NewTaskDialog } from "@/components/crm/quick-create";

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

const COLUMNS = ["Todo", "In progress", "Review", "Done"] as const;

function Tasks() {
  const { rows: tasks, isLoading } = useTasksView();

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
            <SectionCard key={col} title={col} description={`${items.length} tasks`}>
              <div className="space-y-4">
                {items.length === 0 && <p className="text-sm text-subtle">Nothing here yet.</p>}
                {items.map((t) => (
                  <article
                    key={t.id}
                    className="rounded-xl border border-border bg-surface p-4 transition-shadow hover:shadow-card"
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
          );
        })}
      </div>
    </>
  );
}
