import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Check, CircleAlert, Inbox as InboxIcon, Mic, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { SectionCard, Pill } from "@/components/layout/Primitives";
import { useCurrency } from "@/lib/currency";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  useCrmLeads,
  useDealsView,
  useMarkNotificationRead,
  useNotificationsView,
  useRecentActivity,
  useRecentAnalyzedCalls,
  useTasksView,
  useTopPerformers,
  useUpdateTask,
  type TaskView,
} from "@/hooks/use-crm-data";

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-10 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-mint text-mint-foreground">
        <Sparkles className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">{body}</p>
    </div>
  );
}

export function LeaderboardWidget() {
  const { t } = useI18n();
  const { format } = useCurrency();
  const ranked = useTopPerformers(10);

  return (
    <SectionCard
      title={t("widget.leaderboardTitle")}
      description={t("widget.leaderboardDesc")}
      info={t("widget.leaderboardInfo")}
      actions={
        <Link to="/" className="text-xs font-semibold text-primary hover:underline">
          {t("widget.viewAll")}
        </Link>
      }
    >
      {ranked.length === 0 && (
        <EmptyState
          title={t("widget.leaderboardEmptyTitle")}
          body={t("widget.leaderboardEmptyBody")}
        />
      )}
      <ul className="space-y-3">
        {ranked.map((rep, i) => {
          const pct = rep.target ? Math.round((rep.revenue / rep.target) * 100) : null;
          return (
            <li
              key={rep.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2 py-2 transition-colors duration-150 hover:bg-accent"
            >
              <span
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-bold",
                  i === 0
                    ? "bg-warning/20 text-warning-foreground"
                    : i < 3
                      ? "bg-mint text-mint-foreground"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{rep.name}</p>
                <p className="truncate text-[11px] text-subtle">
                  {rep.department} · {t("widget.dealsCount", { count: rep.deals })}
                </p>
                {pct != null && (
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-[width] duration-700",
                        pct >= 100 ? "bg-success" : "bg-primary",
                      )}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-foreground">{format(rep.revenue)}</p>
                <p className="text-[11px] text-subtle">
                  {pct != null ? `${pct}%` : t("widget.noTarget")}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

const priorityTone = (p: TaskView["priority"]) =>
  p === "Urgent" ? "danger" : p === "High" ? "warning" : p === "Low" ? "neutral" : "info";

function bucketOf(task: TaskView): "Overdue" | "Today" | "Upcoming" | null {
  if (!task.dueRaw) return "Upcoming";
  const due = new Date(task.dueRaw);
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 86400000);
  if (due < startOfDay) return "Overdue";
  if (due < endOfDay) return "Today";
  return "Upcoming";
}

export function ImportantTasksWidget() {
  const { t } = useI18n();
  const { rows: tasks } = useTasksView();
  const updateTask = useUpdateTask();
  const buckets: Array<"Overdue" | "Today" | "Upcoming"> = ["Overdue", "Today", "Upcoming"];
  const bucketLabel: Record<(typeof buckets)[number], string> = {
    Overdue: t("widget.bucketOverdue"),
    Today: t("widget.bucketToday"),
    Upcoming: t("widget.bucketUpcoming"),
  };

  const openTasks = useMemo(
    () => tasks.filter((task) => !task.leadId && task.status !== "Done"),
    [tasks],
  );

  return (
    <SectionCard
      title={t("widget.importantTasksTitle")}
      description={t("widget.importantTasksDesc")}
      info={t("widget.importantTasksInfo")}
    >
      <div className="space-y-5">
        {buckets.map((bucket) => {
          const items = openTasks.filter((task) => bucketOf(task) === bucket);
          return (
            <div key={bucket}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-subtle">
                {bucketLabel[bucket]}
              </p>
              {items.length === 0 ? (
                <p className="rounded-xl bg-mint px-3 py-2 text-xs text-mint-foreground">
                  {t("widget.allClearIn", { bucket: bucketLabel[bucket].toLowerCase() })}
                </p>
              ) : (
                <ul className="space-y-2">
                  {items.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-start gap-3 rounded-xl border border-border p-3 transition-colors duration-150 hover:bg-accent"
                    >
                      <button
                        aria-label={t("widget.completeAria", { title: task.title })}
                        onClick={() => {
                          updateTask.mutate({
                            id: task.id,
                            patch: { status: "Done", progress: 100 },
                          });
                          toast.success(t("widget.taskCompletedToast"), {
                            description: task.title,
                          });
                        }}
                        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border border-border text-transparent transition-colors hover:border-success hover:text-success focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                        <p className="mt-0.5 truncate text-[11px] text-subtle">
                          {task.assignee} · {task.due}
                        </p>
                      </div>
                      <Pill tone={priorityTone(task.priority)}>{task.priority}</Pill>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

export function LeadTasksWidget({ funnel = null }: { funnel?: string | null }) {
  const { t } = useI18n();
  const { rows: tasks } = useTasksView();
  const leadTasks = useMemo(
    () =>
      tasks.filter(
        (task) => task.leadId && task.status !== "Done" && (!funnel || task.funnel === funnel),
      ),
    [tasks, funnel],
  );

  const groups: Array<{ label: string; items: TaskView[] }> = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(startOfDay.getTime() + 86400000);
    const weekEnd = new Date(startOfDay.getTime() + 7 * 86400000);
    const today = leadTasks.filter((task) => task.dueRaw && new Date(task.dueRaw) < tomorrow);
    const tmrw = leadTasks.filter(
      (task) =>
        task.dueRaw &&
        new Date(task.dueRaw) >= tomorrow &&
        new Date(task.dueRaw) < new Date(tomorrow.getTime() + 86400000),
    );
    const week = leadTasks.filter(
      (task) =>
        task.dueRaw &&
        new Date(task.dueRaw) >= new Date(tomorrow.getTime() + 86400000) &&
        new Date(task.dueRaw) < weekEnd,
    );
    return [
      { label: t("widget.groupToday"), items: today },
      { label: t("widget.groupTomorrow"), items: tmrw },
      { label: t("widget.groupThisWeek"), items: week },
    ];
  }, [leadTasks, t]);

  return (
    <SectionCard
      title={t("widget.leadTasksTitle")}
      description={t("widget.leadTasksDesc")}
      info={t("widget.leadTasksInfo")}
    >
      <div className="space-y-5">
        {leadTasks.length === 0 && <p className="text-sm text-subtle">{t("widget.noLeadTasks")}</p>}
        {groups.map((g) =>
          g.items.length === 0 ? null : (
            <div key={g.label}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-subtle">
                {g.label}
              </p>
              <ul className="space-y-2">
                {g.items.map((task) => (
                  <li
                    key={task.id}
                    className="rounded-xl border border-border p-3 transition-colors duration-150 hover:bg-accent"
                  >
                    <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-subtle">
                      {task.leadName ?? "—"} · {task.assignee}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ),
        )}
      </div>
    </SectionCard>
  );
}

export function InboxWidget() {
  const { t } = useI18n();
  const { rows: notifications } = useNotificationsView();
  const markRead = useMarkNotificationRead();
  const items = notifications.slice(0, 5);
  return (
    <SectionCard
      title={t("widget.inboxTitle")}
      description={t("widget.inboxDesc")}
      info={t("widget.inboxInfo")}
      actions={
        <Link to="/inbox" className="text-xs font-semibold text-primary hover:underline">
          {t("widget.openInbox")}
        </Link>
      }
    >
      {items.length === 0 ? (
        <EmptyState title={t("widget.inboxZeroTitle")} body={t("widget.inboxZeroBody")} />
      ) : (
        <ul className="space-y-3">
          {items.map((n) => (
            <li
              key={n.id}
              onClick={() => n.unread && markRead.mutate(n.id)}
              className={cn(
                "flex items-start gap-3 rounded-xl p-2 transition-colors duration-150 hover:bg-accent",
                n.unread && "cursor-pointer",
              )}
            >
              <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                <InboxIcon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{n.title}</p>
                <p className="mt-0.5 truncate text-[11px] text-subtle">{n.meta}</p>
              </div>
              {n.unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export function ActivityWidget({ funnel = null }: { funnel?: string | null }) {
  const { t } = useI18n();
  const { rows: activity } = useRecentActivity(8, funnel);
  return (
    <SectionCard
      title={t("widget.activityTitle")}
      description={t("widget.activityDesc")}
      info={t("widget.activityInfo")}
    >
      {activity.length === 0 && <p className="text-sm text-subtle">{t("widget.noActivity")}</p>}
      <ol className="relative space-y-5 border-l border-border pl-5">
        {activity.map((a) => (
          <li key={a.id} className="relative">
            <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
            <p className="text-sm text-foreground">
              <span className="font-medium">{a.who}</span> — {a.what}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-subtle">
              {a.leadName && (
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground">
                  {a.leadName}
                </span>
              )}
              <span>{a.when}</span>
            </p>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}

export function AudioPreviewWidget({ funnel = null }: { funnel?: string | null }) {
  const { t } = useI18n();
  const { rows: calls, isLoading } = useRecentAnalyzedCalls(funnel, 5);
  return (
    <SectionCard
      title={t("widget.audioTitle")}
      description={t("widget.audioDesc")}
      info={t("widget.audioInfo")}
      actions={
        <Link to="/audio-analytics" className="text-xs font-semibold text-primary hover:underline">
          {calls.length === 0 ? t("widget.setUp") : t("widget.viewAll")}
        </Link>
      }
    >
      {!isLoading && calls.length === 0 ? (
        <EmptyState title={t("widget.audioEmptyTitle")} body={t("widget.audioEmptyBody")} />
      ) : (
        <ul className="space-y-3">
          {calls.map((c) => (
            <li
              key={c.id}
              className="flex items-start gap-3 rounded-xl px-2 py-2 transition-colors duration-150 hover:bg-accent"
            >
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Mic className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{c.leadName}</p>
                <p className="mt-0.5 truncate text-[11px] text-subtle">
                  {c.nextStep || c.mood || t("widget.audioNoNote")} · {c.occurredAt}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <Pill tone={c.score >= 80 ? "success" : c.score >= 50 ? "warning" : "danger"}>
                  {c.score}
                </Pill>
                {c.mood && (
                  <p className="mt-1 text-[10px] font-semibold uppercase text-subtle">{c.mood}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export function AiInsightsWidget() {
  const { t } = useI18n();
  const { format } = useCurrency();
  const { rows: leads } = useCrmLeads();
  const { rows: deals } = useDealsView();
  const top = useTopPerformers(1)[0];

  const insights = useMemo(() => {
    const out: {
      id: string;
      tone: "success" | "warning" | "danger" | "info";
      title: string;
      body: string;
    }[] = [];
    if (top && top.revenue > 0) {
      out.push({
        id: "top",
        tone: "success",
        title: t("widget.insightTopTitle", { name: top.name }),
        body: t("widget.insightTopBody", { revenue: format(top.revenue), deals: top.deals }),
      });
    }
    const hot = leads.filter(
      (l) => l.temperature === "Hot" && l.stage !== "Won" && l.stage !== "Lost",
    );
    if (hot.length) {
      out.push({
        id: "hot",
        tone: "warning",
        title: t("widget.insightHotTitle", { count: hot.length }),
        body: t("widget.insightHotBody"),
      });
    }
    const openDeals = deals.filter((d) => d.status === "open");
    if (openDeals.length) {
      const weighted = openDeals.reduce((s, d) => s + (d.value * d.probability) / 100, 0);
      out.push({
        id: "pipeline",
        tone: "info",
        title: t("widget.insightPipelineTitle", { value: format(weighted) }),
        body: t("widget.insightPipelineBody", { count: openDeals.length }),
      });
    }
    if (out.length === 0) {
      out.push({
        id: "empty",
        tone: "info",
        title: t("widget.insightEmptyTitle"),
        body: t("widget.insightEmptyBody"),
      });
    }
    return out;
  }, [leads, deals, top, t, format]);

  const insightTone = {
    danger: "bg-destructive/10 text-destructive",
    success: "bg-mint text-mint-foreground",
    warning: "bg-warning/15 text-warning-foreground",
    info: "bg-primary/10 text-primary",
  } as const;

  return (
    <SectionCard title={t("widget.aiInsightsTitle")} description={t("widget.aiInsightsDesc")}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {insights.map((i) => (
          <article
            key={i.id}
            className="rounded-xl border border-border p-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-elevated"
          >
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold",
                insightTone[i.tone],
              )}
            >
              <CircleAlert className="h-3 w-3" />
              {t("widget.insightBadge")}
            </span>
            <p className="mt-3 text-sm font-semibold text-foreground">{i.title}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{i.body}</p>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}
