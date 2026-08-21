import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type DragEvent } from "react";
import {
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Loader2,
  Plus,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionCard, Pill } from "@/components/layout/Primitives";
import {
  useAsOfSnapshot,
  useCreateTaskComment,
  usePermission,
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
import { AsOfDatePicker, AsOfBanner } from "@/components/filters/AsOfDatePicker";
import { PermissionGate } from "@/components/PermissionGate";

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
  component: TasksGated,
});

function TasksGated() {
  return (
    <PermissionGate action="View tasks">
      <Tasks />
    </PermissionGate>
  );
}

const COLUMNS: TaskRow["status"][] = ["Todo", "In progress", "Review", "Done"];

function nextColumn(status: TaskRow["status"]): TaskRow["status"] | null {
  const i = COLUMNS.indexOf(status);
  return i >= 0 && i < COLUMNS.length - 1 ? COLUMNS[i + 1]! : null;
}

const MONTH_FORMAT = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const WEEKDAY_FORMAT = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
// 2024-01-01 is a Monday — used only as a stable reference week to render
// locale weekday abbreviations in Mon..Sun order.
const WEEKDAY_LABELS = Array.from({ length: 7 }, (_, i) =>
  WEEKDAY_FORMAT.format(new Date(2024, 0, 1 + i)),
);

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function sameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

function monthGrid(month: Date): Date[] {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const startOffset = (start.getDay() + 6) % 7; // Monday-first
  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - startOffset);
  const totalCells = Math.ceil((startOffset + end.getDate()) / 7) * 7;
  return Array.from({ length: totalCells }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

function CalendarView({
  tasks,
  onSelect,
}: {
  tasks: TaskView[];
  onSelect: (task: TaskView) => void;
}) {
  const { t } = useI18n();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const days = useMemo(() => monthGrid(month), [month]);
  const today = useMemo(() => new Date(), []);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskView[]>();
    for (const task of tasks) {
      if (!task.dueRaw) continue;
      const key = dayKey(new Date(task.dueRaw));
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    return map;
  }, [tasks]);

  const upcoming = useMemo(
    () =>
      tasks
        .filter((task) => task.dueRaw && task.status !== "Done")
        .sort((a, b) => new Date(a.dueRaw!).getTime() - new Date(b.dueRaw!).getTime())
        .slice(0, 8),
    [tasks],
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <SectionCard
        title={MONTH_FORMAT.format(month)}
        actions={
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={t("tasks.calendarPrevMonth")}
              onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={t("tasks.calendarNextMonth")}
              onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border text-xs">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="bg-surface px-2 py-2 text-center font-medium text-subtle">
              {label}
            </div>
          ))}
          {days.map((day) => {
            const dayTasks = tasksByDay.get(dayKey(day)) ?? [];
            const inMonth = day.getMonth() === month.getMonth();
            return (
              <div
                key={day.toISOString()}
                className={cn("min-h-[92px] bg-background p-1.5", !inMonth && "opacity-40")}
              >
                <p
                  className={cn(
                    "mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px]",
                    sameDay(day, today)
                      ? "bg-primary font-semibold text-primary-foreground"
                      : "text-subtle",
                  )}
                >
                  {day.getDate()}
                </p>
                <div className="space-y-1">
                  {dayTasks.slice(0, 2).map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => onSelect(task)}
                      className={cn(
                        "block w-full truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium",
                        task.priority === "Urgent"
                          ? "bg-destructive/10 text-destructive"
                          : task.priority === "High"
                            ? "bg-warning/15 text-warning-foreground"
                            : "bg-primary/10 text-primary",
                      )}
                    >
                      {task.title}
                    </button>
                  ))}
                  {dayTasks.length > 2 && (
                    <p className="px-1.5 text-[10px] text-subtle">
                      {t("tasks.calendarMore", { count: dayTasks.length - 2 })}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        title={t("tasks.calendarSidebarTitle")}
        description={t("tasks.calendarSidebarDesc")}
      >
        {upcoming.length === 0 ? (
          <p className="text-sm text-subtle">{t("tasks.calendarNoUpcoming")}</p>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => onSelect(task)}
                  className="w-full rounded-xl border border-border bg-surface p-3 text-left transition-shadow hover:shadow-card"
                >
                  <div className="flex items-center justify-between gap-2">
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
                    <span className="text-[11px] text-subtle">{task.due}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground">{task.title}</p>
                  <p className="mt-1 text-xs text-subtle">{task.assignee}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

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
  const [asOfDate, setAsOfDate] = useState<Date | null>(null);
  const asOfSnapshot = useAsOfSnapshot<TaskRow>("tasks", asOfDate);
  const { rows: allTasks, isLoading: tasksLoading } = useTasksView(
    asOfDate ? (asOfSnapshot.data ?? []) : undefined,
  );
  const isLoading = tasksLoading || (asOfDate ? asOfSnapshot.isLoading : false);
  const updateTask = useUpdateTask();
  const canCreateTasks = usePermission("Create tasks");
  // useTasksView() already scopes rows to what this role may see (self for
  // sotuv_menejeri, own team for rop, everyone for super_admin).
  const tasks = allTasks;
  const [dragOverCol, setDragOverCol] = useState<TaskRow["status"] | null>(null);
  const [selected, setSelected] = useState<TaskView | null>(null);
  const [view, setView] = useState<"gallery" | "calendar">("gallery");

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
    if (asOfDate) return;
    const id = e.dataTransfer.getData("text/plain");
    if (id) void moveTask(id, col);
  }

  return (
    <>
      <PageHeader
        title={t("tasks.title")}
        description={t("tasks.desc")}
        actions={
          <>
            <div className="inline-flex items-center rounded-xl border border-border bg-surface p-1">
              <button
                type="button"
                onClick={() => setView("gallery")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  view === "gallery"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                <LayoutGrid className="h-4 w-4" /> {t("tasks.viewGallery")}
              </button>
              <button
                type="button"
                onClick={() => setView("calendar")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  view === "calendar"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                <CalendarIcon className="h-4 w-4" /> {t("tasks.viewCalendar")}
              </button>
            </div>
            <AsOfDatePicker value={asOfDate} onChange={setAsOfDate} />
            {!asOfDate && canCreateTasks && (
              <NewTaskDialog
                trigger={
                  <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition-colors hover:bg-primary/90">
                    <Plus className="h-4 w-4" /> {t("tasks.newTask")}
                  </button>
                }
              />
            )}
          </>
        }
      />

      <AsOfBanner value={asOfDate} />

      {isLoading && (
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("tasks.loading")}
        </div>
      )}

      {view === "calendar" ? (
        <CalendarView tasks={tasks.filter((task) => !task.leadId)} onSelect={setSelected} />
      ) : (
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
                    {items.map((task) => {
                      const next = nextColumn(task.status);
                      const isDone = task.status === "Done";
                      return (
                        <article
                          key={task.id}
                          draggable={!asOfDate}
                          onDragStart={(e) => onDragStart(e, task.id)}
                          onClick={() => setSelected(task)}
                          className={cn(
                            "rounded-xl border border-border bg-surface p-4 transition-shadow hover:shadow-card",
                            asOfDate ? "cursor-default" : "cursor-grab active:cursor-grabbing",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              aria-label={t("tasks.markDoneAria")}
                              title={t("tasks.markDone")}
                              disabled={!!asOfDate}
                              onClick={(e) => {
                                e.stopPropagation();
                                void moveTask(task.id, isDone ? "Todo" : "Done");
                              }}
                              className={cn(
                                "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors",
                                isDone
                                  ? "border-success bg-success text-success-foreground"
                                  : "border-border text-transparent hover:border-success",
                              )}
                            >
                              <Check className="h-3 w-3" strokeWidth={3} />
                            </button>
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
                          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-subtle">
                            <span>
                              {task.assignee.split(" ")[0]} · {task.due}
                            </span>
                            {next && !asOfDate && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void moveTask(task.id, next);
                                }}
                                className="shrink-0 rounded-lg bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20"
                              >
                                {t("tasks.advanceTo", { status: columnLabel[next] })}
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </SectionCard>
              </div>
            );
          })}
        </div>
      )}

      {selected && <TaskDetailDialog task={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
