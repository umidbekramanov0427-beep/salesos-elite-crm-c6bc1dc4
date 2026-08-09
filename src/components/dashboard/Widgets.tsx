import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Check, CircleAlert, Inbox as InboxIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { SectionCard, Pill } from "@/components/layout/Primitives";
import { currency } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import {
  useCrmLeads,
  useDealsView,
  useMarkNotificationRead,
  useNotificationsView,
  useRecentActivity,
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
  const ranked = useTopPerformers(10);

  return (
    <SectionCard
      title="Leaderboard"
      description="Top performers by closed revenue"
      actions={
        <Link to="/" className="text-xs font-semibold text-primary hover:underline">
          View all
        </Link>
      }
    >
      {ranked.length === 0 && (
        <EmptyState
          title="No closed deals yet"
          body="Once deals are marked Won, top performers show up here."
        />
      )}
      <ul className="space-y-3">
        {ranked.map((rep, i) => {
          const pct = Math.round((rep.revenue / rep.target) * 100);
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
                  {rep.department} · {rep.deals} deals
                </p>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-700",
                      pct >= 100 ? "bg-success" : "bg-primary",
                    )}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-foreground">{currency(rep.revenue)}</p>
                <p className="text-[11px] text-subtle">{pct}%</p>
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
  const { rows: tasks } = useTasksView();
  const updateTask = useUpdateTask();
  const buckets: Array<"Overdue" | "Today" | "Upcoming"> = ["Overdue", "Today", "Upcoming"];

  const openTasks = useMemo(() => tasks.filter((t) => !t.leadId && t.status !== "Done"), [tasks]);

  return (
    <SectionCard title="Important tasks" description="Overdue, today and upcoming">
      <div className="space-y-5">
        {buckets.map((bucket) => {
          const items = openTasks.filter((t) => bucketOf(t) === bucket);
          return (
            <div key={bucket}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-subtle">
                {bucket}
              </p>
              {items.length === 0 ? (
                <p className="rounded-xl bg-mint px-3 py-2 text-xs text-mint-foreground">
                  All clear in {bucket.toLowerCase()}.
                </p>
              ) : (
                <ul className="space-y-2">
                  {items.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-start gap-3 rounded-xl border border-border p-3 transition-colors duration-150 hover:bg-accent"
                    >
                      <button
                        aria-label={`Complete ${t.title}`}
                        onClick={() => {
                          updateTask.mutate({ id: t.id, patch: { status: "Done", progress: 100 } });
                          toast.success("Task completed", { description: t.title });
                        }}
                        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border border-border text-transparent transition-colors hover:border-success hover:text-success focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{t.title}</p>
                        <p className="mt-0.5 truncate text-[11px] text-subtle">
                          {t.assignee} · {t.due}
                        </p>
                      </div>
                      <Pill tone={priorityTone(t.priority)}>{t.priority}</Pill>
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

export function LeadTasksWidget() {
  const { rows: tasks } = useTasksView();
  const leadTasks = useMemo(() => tasks.filter((t) => t.leadId && t.status !== "Done"), [tasks]);

  const groups: Array<{ label: string; items: TaskView[] }> = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(startOfDay.getTime() + 86400000);
    const weekEnd = new Date(startOfDay.getTime() + 7 * 86400000);
    const today = leadTasks.filter((t) => t.dueRaw && new Date(t.dueRaw) < tomorrow);
    const tmrw = leadTasks.filter(
      (t) =>
        t.dueRaw &&
        new Date(t.dueRaw) >= tomorrow &&
        new Date(t.dueRaw) < new Date(tomorrow.getTime() + 86400000),
    );
    const week = leadTasks.filter(
      (t) =>
        t.dueRaw &&
        new Date(t.dueRaw) >= new Date(tomorrow.getTime() + 86400000) &&
        new Date(t.dueRaw) < weekEnd,
    );
    return [
      { label: "Today", items: today },
      { label: "Tomorrow", items: tmrw },
      { label: "This Week", items: week },
    ];
  }, [leadTasks]);

  return (
    <SectionCard title="Lead tasks" description="Grouped by due date">
      <div className="space-y-5">
        {leadTasks.length === 0 && <p className="text-sm text-subtle">No lead tasks yet.</p>}
        {groups.map((g) =>
          g.items.length === 0 ? null : (
            <div key={g.label}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-subtle">
                {g.label}
              </p>
              <ul className="space-y-2">
                {g.items.map((t) => (
                  <li
                    key={t.id}
                    className="rounded-xl border border-border p-3 transition-colors duration-150 hover:bg-accent"
                  >
                    <p className="truncate text-sm font-medium text-foreground">{t.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-subtle">
                      {t.leadName ?? "—"} · {t.assignee}
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
  const { rows: notifications } = useNotificationsView();
  const markRead = useMarkNotificationRead();
  const items = notifications.slice(0, 5);
  return (
    <SectionCard
      title="Inbox"
      description="Mentions, assignments and automation"
      actions={
        <Link to="/inbox" className="text-xs font-semibold text-primary hover:underline">
          Open inbox
        </Link>
      }
    >
      {items.length === 0 ? (
        <EmptyState title="Inbox zero" body="No notifications need your attention right now." />
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

export function ActivityWidget() {
  const { rows: activity } = useRecentActivity(8);
  return (
    <SectionCard title="Recent activity" description="Latest notes and events across every lead">
      {activity.length === 0 && <p className="text-sm text-subtle">No activity recorded yet.</p>}
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

export function AudioPreviewWidget() {
  return (
    <SectionCard
      title="Audio analytics"
      description="Latest calls with AI scoring"
      actions={
        <Link to="/audio-analytics" className="text-xs font-semibold text-primary hover:underline">
          Set up
        </Link>
      }
    >
      <EmptyState
        title="Not connected yet"
        body="Connect a calling or telephony integration in Settings → Integrations to see call recordings and AI scoring here."
      />
    </SectionCard>
  );
}

export function AiInsightsWidget() {
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
        title: `${top.name} leads the team`,
        body: `${currency(top.revenue)} in closed revenue from ${top.deals} won deal${top.deals === 1 ? "" : "s"} this period.`,
      });
    }
    const hot = leads.filter(
      (l) => l.temperature === "Hot" && l.stage !== "Won" && l.stage !== "Lost",
    );
    if (hot.length) {
      out.push({
        id: "hot",
        tone: "warning",
        title: `${hot.length} hot lead${hot.length === 1 ? "" : "s"} need attention`,
        body: "These leads are marked Hot but haven't closed yet — prioritize follow-up.",
      });
    }
    const openDeals = deals.filter((d) => d.status === "open");
    if (openDeals.length) {
      const weighted = openDeals.reduce((s, d) => s + (d.value * d.probability) / 100, 0);
      out.push({
        id: "pipeline",
        tone: "info",
        title: `${currency(weighted)} weighted pipeline`,
        body: `${openDeals.length} open deal${openDeals.length === 1 ? "" : "s"} across every stage.`,
      });
    }
    if (out.length === 0) {
      out.push({
        id: "empty",
        tone: "info",
        title: "Add your first leads and deals",
        body: "Insights appear here automatically as your team works the pipeline.",
      });
    }
    return out;
  }, [leads, deals, top]);

  const insightTone = {
    danger: "bg-destructive/10 text-destructive",
    success: "bg-mint text-mint-foreground",
    warning: "bg-warning/15 text-warning-foreground",
    info: "bg-primary/10 text-primary",
  } as const;

  return (
    <SectionCard title="Business insights" description="Computed live from your CRM data">
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
              Insight
            </span>
            <p className="mt-3 text-sm font-semibold text-foreground">{i.title}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{i.body}</p>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}
