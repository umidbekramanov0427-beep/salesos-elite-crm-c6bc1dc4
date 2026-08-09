import { createFileRoute } from "@tanstack/react-router";
import { useState, type DragEvent } from "react";
import { Loader2, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionCard, Pill } from "@/components/layout/Primitives";
import {
  useCreateTaskComment,
  useProfilesRaw,
  useTaskComments,
  useTasksView,
  useUpdateTask,
  type TaskRow,
  type TaskView,
} from "@/hooks/use-crm-data";
import { NewTaskDialog } from "@/components/crm/quick-create";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { cn, timeAgo } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

function TaskDetailDialog({ task, onClose }: { task: TaskView; onClose: () => void }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { data: profiles } = useProfilesRaw();
  const { data: comments, isLoading } = useTaskComments(task.id);
  const createComment = useCreateTaskComment();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const authorName = (authorId: string | null) =>
    (authorId && profiles?.find((p) => p.id === authorId)?.full_name) || t("tasks.someone");

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await createComment.mutateAsync({
        taskId: task.id,
        content: text.trim(),
        authorId: user?.id ?? null,
      });
      setText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("tasks.feedbackFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task.title}</DialogTitle>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border border-border bg-surface p-3">
            <dt className="text-[11px] text-subtle">{t("tasks.assignee")}</dt>
            <dd className="mt-1 font-semibold text-foreground">{task.assignee}</dd>
          </div>
          <div className="rounded-xl border border-border bg-surface p-3">
            <dt className="text-[11px] text-subtle">{t("tasks.priority")}</dt>
            <dd className="mt-1 font-semibold text-foreground">{task.priority}</dd>
          </div>
          <div className="rounded-xl border border-border bg-surface p-3">
            <dt className="text-[11px] text-subtle">{t("tasks.status")}</dt>
            <dd className="mt-1 font-semibold text-foreground">{task.status}</dd>
          </div>
          <div className="rounded-xl border border-border bg-surface p-3">
            <dt className="text-[11px] text-subtle">{t("tasks.due")}</dt>
            <dd className="mt-1 font-semibold text-foreground">{task.due}</dd>
          </div>
        </dl>

        <div>
          <p className="mb-1 flex items-center justify-between text-[11px] text-subtle">
            <span>{t("tasks.progress")}</span>
            <span>{task.progress}%</span>
          </p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-success"
              style={{ width: `${task.progress}%` }}
            />
          </div>
        </div>

        {task.description && (
          <p className="rounded-xl bg-surface p-3 text-sm text-muted-foreground">
            {task.description}
          </p>
        )}

        <div className="border-t border-border pt-4">
          <p className="mb-3 text-sm font-semibold text-foreground">{t("tasks.feedback")}</p>
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
            </div>
          )}
          {!isLoading && (comments?.length ?? 0) === 0 && (
            <p className="text-sm text-subtle">{t("tasks.feedbackEmpty")}</p>
          )}
          <ul className="space-y-3">
            {(comments ?? []).map((c) => (
              <li key={c.id} className="rounded-xl border border-border bg-surface p-3">
                <p className="text-sm text-foreground">{c.content}</p>
                <p className="mt-1.5 text-[11px] text-subtle">
                  {authorName(c.author_id)} · {timeAgo(c.created_at)}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void send()}
              placeholder={t("tasks.feedbackPlaceholder")}
              className="h-10 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none placeholder:text-subtle focus:border-primary/40"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy || !text.trim()}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {t("tasks.feedbackSend")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Tasks() {
  const { t } = useI18n();
  const { rows: tasks, isLoading } = useTasksView();
  const updateTask = useUpdateTask();
  const [dragOverCol, setDragOverCol] = useState<TaskRow["status"] | null>(null);
  const [selected, setSelected] = useState<TaskView | null>(null);

  const columnLabel: Record<TaskRow["status"], string> = {
    Todo: t("tasks.colTodo"),
    "In progress": t("tasks.colInProgress"),
    Review: t("tasks.colReview"),
    Done: t("tasks.colDone"),
  };

  async function moveTask(id: string, status: TaskRow["status"]) {
    try {
      await updateTask.mutateAsync({ id, patch: { status } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("tasks.moveFailed"));
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
        title={t("tasks.title")}
        description={t("tasks.desc")}
        actions={
          <NewTaskDialog
            trigger={
              <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition-colors hover:bg-primary/90">
                <Plus className="h-4 w-4" /> {t("tasks.newTask")}
              </button>
            }
          />
        }
      />

      {isLoading && (
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("tasks.loading")}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = tasks.filter((task) => task.status === col && !task.leadId);
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
              <SectionCard
                title={columnLabel[col]}
                description={t("tasks.taskCount", { count: items.length })}
              >
                <div className="min-h-[80px] space-y-4">
                  {items.length === 0 && (
                    <p className="text-sm text-subtle">{t("tasks.nothingHere")}</p>
                  )}
                  {items.map((task) => (
                    <article
                      key={task.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, task.id)}
                      onClick={() => setSelected(task)}
                      className="cursor-grab rounded-xl border border-border bg-surface p-4 transition-shadow hover:shadow-card active:cursor-grabbing"
                    >
                      <div className="flex items-center justify-between">
                        <Pill
                          tone={
                            task.priority === "Urgent"
                              ? "danger"
                              : task.priority === "High"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {task.priority}
                        </Pill>
                      </div>
                      <p className="mt-2 text-sm font-medium leading-snug text-foreground">
                        {task.title}
                      </p>
                      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full rounded-full bg-success"
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-subtle">
                        <span>
                          {task.assignee.split(" ")[0]} · {task.due}
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

      {selected && <TaskDetailDialog task={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
