import { createFileRoute } from "@tanstack/react-router";
import { Paperclip, MessageSquare, Plus } from "lucide-react";
import { PageHeader, SectionCard, Pill } from "@/components/layout/Primitives";
import { TASKS } from "@/lib/mock-data";

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "Important Tasks — SalesOS Elite" },
      { name: "description", content: "Admin-created tasks with assignees, priority, deadlines, progress, files and comments." },
      { property: "og:title", content: "Important Tasks — SalesOS Elite" },
      { property: "og:description", content: "Company-wide task board with priority, deadlines and progress." },
    ],
  }),
  component: Tasks,
});

const COLUMNS = ["Todo", "In progress", "Review", "Done"] as const;

function Tasks() {
  return (
    <>
      <PageHeader
        title="Important Tasks"
        description="Company-level work assigned by admins, tracked to completion."
        actions={
          <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition-colors hover:bg-primary/90">
            <Plus className="h-4 w-4" /> New task
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = TASKS.filter((t) => t.status === col);
          return (
            <SectionCard key={col} title={col} description={`${items.length} tasks`}>
              <div className="space-y-4">
                {items.length === 0 && <p className="text-sm text-subtle">Nothing here yet.</p>}
                {items.map((t) => (
                  <article key={t.id} className="rounded-xl border border-border bg-surface p-4 transition-shadow hover:shadow-card">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-subtle">{t.id}</span>
                      <Pill tone={t.priority === "Urgent" ? "danger" : t.priority === "High" ? "warning" : "neutral"}>
                        {t.priority}
                      </Pill>
                    </div>
                    <p className="mt-2 text-sm font-medium leading-snug text-foreground">{t.title}</p>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-border">
                      <div className="h-full rounded-full bg-success" style={{ width: `${t.progress}%` }} />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-subtle">
                      <span>{t.assignee.split(" ")[0]} · {t.due}</span>
                      <span className="flex items-center gap-2">
                        <Paperclip className="h-3.5 w-3.5" />2
                        <MessageSquare className="h-3.5 w-3.5" />4
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
