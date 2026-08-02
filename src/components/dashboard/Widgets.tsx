import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AudioLines, Check, CircleAlert, Inbox as InboxIcon, Play, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { SectionCard, Pill } from "@/components/layout/Primitives";
import { REPS, CALLS, NOTIFICATIONS, currency } from "@/lib/mock-data";
import {
  DASHBOARD_TASKS,
  DASHBOARD_LEAD_TASKS,
  ACTIVITY_TIMELINE,
  AI_INSIGHTS,
  type BoardTask,
} from "@/lib/dashboard-data";
import { cn } from "@/lib/utils";

function EmptyState({ title, body, action }: { title: string; body: string; action: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-10 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-mint text-mint-foreground">
        <Sparkles className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">{body}</p>
      <button
        onClick={() => toast.info(action)}
        className="mt-4 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        {action}
      </button>
    </div>
  );
}

export function LeaderboardWidget() {
  const ranked = [...REPS].sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  return (
    <SectionCard
      title="Leaderboard"
      description="Top performers this month"
      actions={
        <Link to="/" className="text-xs font-semibold text-primary hover:underline">
          View all
        </Link>
      }
    >
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
                  i === 0 ? "bg-warning/20 text-warning-foreground" : i < 3 ? "bg-mint text-mint-foreground" : "bg-muted text-muted-foreground",
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
                    className={cn("h-full rounded-full transition-[width] duration-700", pct >= 100 ? "bg-success" : "bg-primary")}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-foreground">{currency(rep.revenue)}</p>
                <p className="text-[11px] text-subtle">
                  {pct}%{pct >= 100 && <span className="ml-1 font-semibold text-success">+5% bonus</span>}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

const priorityTone = (p: BoardTask["priority"]) =>
  p === "Urgent" ? "danger" : p === "High" ? "warning" : p === "Low" ? "neutral" : "info";

export function ImportantTasksWidget() {
  const [done, setDone] = useState<string[]>([]);
  const buckets: BoardTask["bucket"][] = ["Overdue", "Today", "Upcoming"];

  return (
    <SectionCard title="Important tasks" description="Overdue, today and upcoming">
      <div className="space-y-5">
        {buckets.map((bucket) => {
          const items = DASHBOARD_TASKS.filter((t) => t.bucket === bucket && !done.includes(t.id));
          return (
            <div key={bucket}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-subtle">{bucket}</p>
              {items.length === 0 ? (
                <p className="rounded-xl bg-mint px-3 py-2 text-xs text-mint-foreground">All clear in {bucket.toLowerCase()}.</p>
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
                          setDone((d) => [...d, t.id]);
                          toast.success("Task completed", { description: t.title });
                        }}
                        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border border-border text-transparent transition-colors hover:border-success hover:text-success focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{t.title}</p>
                        <p className="mt-0.5 truncate text-[11px] text-subtle">{t.meta}</p>
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
  const groups = ["Today", "Tomorrow", "This Week"] as const;
  return (
    <SectionCard title="Lead tasks" description="Grouped by due date">
      <div className="space-y-5">
        {groups.map((g) => {
          const items = DASHBOARD_LEAD_TASKS.filter((t) => t.group === g);
          return (
            <div key={g}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-subtle">{g}</p>
              <ul className="space-y-2">
                {items.map((t) => (
                  <li key={t.id} className="rounded-xl border border-border p-3 transition-colors duration-150 hover:bg-accent">
                    <p className="truncate text-sm font-medium text-foreground">{t.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-subtle">
                      {t.lead} · {t.owner}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

export function InboxWidget() {
  const items = NOTIFICATIONS.slice(0, 5);
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
        <EmptyState title="Inbox zero" body="No notifications need your attention right now." action="Create a task" />
      ) : (
        <ul className="space-y-3">
          {items.map((n) => (
            <li key={n.id} className="flex items-start gap-3 rounded-xl p-2 transition-colors duration-150 hover:bg-accent">
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
  return (
    <SectionCard title="Recent activity" description="Every change, with old and new value">
      <ol className="relative space-y-5 border-l border-border pl-5">
        {ACTIVITY_TIMELINE.map((a) => (
          <li key={a.id} className="relative">
            <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
            <p className="text-sm text-foreground">
              <span className="font-medium">{a.who}</span> {a.what}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground line-through">{a.from}</span>
              <span className="text-subtle">→</span>
              <span className="rounded-md bg-mint px-1.5 py-0.5 font-medium text-mint-foreground">{a.to}</span>
              <span className="text-subtle">· {a.when}</span>
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
          All calls
        </Link>
      }
    >
      <ul className="space-y-3">
        {CALLS.slice(0, 4).map((c) => (
          <li key={c.id} className="rounded-xl border border-border p-3 transition-colors duration-150 hover:bg-accent">
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
              <button
                aria-label={`Play recording ${c.id}`}
                onClick={() => toast.info(`Playing ${c.id} — ${c.company}`)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Play className="h-3.5 w-3.5" />
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{c.company}</p>
                <p className="truncate text-[11px] text-subtle">
                  {c.rep} · {c.duration} · {c.objection}
                </p>
              </div>
              <Pill tone={c.sentiment === "Positive" ? "success" : c.sentiment === "Negative" ? "danger" : "neutral"}>
                {c.score}
              </Pill>
            </div>
            <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
              <AudioLines className="mt-0.5 h-3 w-3 shrink-0" />
              {c.summary}
            </p>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

const insightTone = {
  danger: "bg-destructive/10 text-destructive",
  success: "bg-mint text-mint-foreground",
  warning: "bg-warning/15 text-warning-foreground",
  info: "bg-primary/10 text-primary",
} as const;

export function AiInsightsWidget() {
  return (
    <SectionCard
      title="AI business insights"
      description="Generated today at 08:00"
      actions={
        <button
          onClick={() => toast.success("Regenerating insights…")}
          className="rounded-xl border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Regenerate
        </button>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {AI_INSIGHTS.map((i) => (
          <article key={i.id} className="rounded-xl border border-border p-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-elevated">
            <span className={cn("inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold", insightTone[i.tone])}>
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
