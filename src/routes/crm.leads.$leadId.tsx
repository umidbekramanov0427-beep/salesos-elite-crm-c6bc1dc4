import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Bot,
  CalendarClock,
  Loader2,
  MessageCircle,
  Mail,
  Phone,
  Send,
} from "lucide-react";
import { SectionCard, Pill } from "@/components/layout/Primitives";
import { TagEditor } from "@/components/crm/tag-editor";
import { AI_SUGGESTIONS } from "@/lib/crm-data";
import { currency } from "@/lib/mock-data";
import { cn, timeAgo } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import {
  useCreateLeadActivity,
  useCreateTask,
  useCrmLeads,
  useLeadActivities,
  useTasksView,
} from "@/hooks/use-crm-data";

export const Route = createFileRoute("/crm/leads/$leadId")({
  head: () => ({
    meta: [
      { title: "Lead workspace — SalesOS Elite CRM" },
      {
        name: "description",
        content: "Full CRM workspace for a lead: timeline, tasks, notes and AI assistance.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LeadWorkspace,
});

function LeadNotFound() {
  return (
    <SectionCard title="Lead unavailable" description="This lead does not exist or was archived.">
      <Link to="/crm/leads" className="text-sm font-semibold text-primary">
        Back to leads
      </Link>
    </SectionCard>
  );
}

const TABS = ["Timeline", "Notes", "Tasks", "WhatsApp", "Telegram", "Email"] as const;

function LeadWorkspace() {
  const { leadId } = Route.useParams();
  const { user } = useAuth();
  const { rows: leads, profiles, isLoading } = useCrmLeads();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Timeline");

  const lead = leads.find((l) => l.id === leadId);

  const activities = useLeadActivities(lead?.id);
  const createActivity = useCreateLeadActivity();
  const createTask = useCreateTask();
  const { rows: allTasks } = useTasksView();

  const leadTasks = useMemo(
    () => allTasks.filter((t) => t.leadId === lead?.id),
    [allTasks, lead?.id],
  );
  const upcoming = useMemo(
    () =>
      leadTasks
        .filter((t) => t.dueRaw)
        .sort((a, b) => new Date(a.dueRaw!).getTime() - new Date(b.dueRaw!).getTime())
        .slice(0, 3),
    [leadTasks],
  );

  const [noteText, setNoteText] = useState("");
  const [taskTitle, setTaskTitle] = useState("");

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading lead…
      </div>
    );
  }
  if (!lead) return <LeadNotFound />;

  async function saveNote() {
    if (!noteText.trim() || !lead) return;
    await createActivity.mutateAsync({
      lead_id: lead.id,
      type: "note",
      content: noteText.trim(),
      created_by: user?.id ?? null,
    });
    setNoteText("");
  }

  async function addTask() {
    if (!taskTitle.trim() || !lead) return;
    await createTask.mutateAsync({
      title: taskTitle.trim(),
      lead_id: lead.id,
      assignee_id: user?.id ?? null,
      created_by: user?.id ?? null,
    });
    setTaskTitle("");
  }

  const profileName = (id: string | null) =>
    profiles.find((p) => p.id === id)?.full_name || "Someone";

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            to="/crm/leads"
            className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-accent"
            aria-label="Back to leads"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint text-sm font-semibold text-mint-foreground">
            {lead.initials}
          </span>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{lead.name}</h1>
            <p className="text-sm text-muted-foreground">
              {lead.position || "—"} · {lead.company || "—"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={lead.temperature === "Hot" ? "danger" : "warning"}>{lead.temperature}</Pill>
          <Pill tone={lead.stage === "Won" ? "success" : "info"}>{lead.stage}</Pill>
          {[
            { icon: Phone, label: "Call" },
            { icon: MessageCircle, label: "WhatsApp" },
            { icon: Send, label: "Telegram" },
            { icon: Mail, label: "Email" },
          ].map((a) => (
            <button
              key={a.label}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-medium text-muted-foreground hover:bg-accent"
            >
              <a.icon className="h-4 w-4" /> {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
        {/* LEFT — lead information */}
        <div className="space-y-6">
          <SectionCard title="Lead information">
            <dl className="space-y-3 text-sm">
              {[
                ["Phone", lead.phone || "—"],
                ["Additional phone", lead.altPhone || "—"],
                ["Email", lead.email || "—"],
                ["Telegram", lead.telegram || "—"],
                ["WhatsApp", lead.whatsapp || "—"],
                ["Source", lead.source || "—"],
                ["Campaign", lead.campaign || "—"],
                ["Owner", lead.owner],
                ["Manager", lead.manager],
                ["Priority", lead.priority],
                ["Budget", currency(lead.budget)],
                ["Expected revenue", currency(lead.expectedRevenue)],
                ["Funnel", lead.funnel || "—"],
                ["Next follow up", lead.nextFollowUp],
                ["Last contact", lead.lastContact],
                ["Created", lead.created],
                ["Updated", lead.updated],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-3">
                  <dt className="text-subtle">{k}</dt>
                  <dd className="text-right font-medium text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </SectionCard>

          <SectionCard title="Location">
            <p className="text-sm text-muted-foreground">{lead.address || "—"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {lead.city || "—"}, {lead.region || "—"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{lead.country || "—"}</p>
          </SectionCard>

          <SectionCard title="Tags">
            <TagEditor leadId={lead.id} tags={lead.tags} />
          </SectionCard>
        </div>

        {/* CENTER — workspace tabs */}
        <div className="space-y-6">
          <div className="flex flex-wrap gap-1 rounded-2xl border border-border bg-surface p-1">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  tab === t
                    ? "bg-background text-foreground shadow-soft"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "Timeline" && (
            <SectionCard title="Timeline" description="Every recorded event on this lead">
              {activities.isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              )}
              {!activities.isLoading && (activities.data?.length ?? 0) === 0 && (
                <p className="text-sm text-subtle">No activity recorded yet.</p>
              )}
              <ol className="relative space-y-6 border-l border-border pl-5">
                {(activities.data ?? []).map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={e.type === "ai" ? "success" : "info"}>{e.type}</Pill>
                      <p className="text-sm font-medium text-foreground">{e.content}</p>
                    </div>
                    <p className="mt-1 text-xs text-subtle">
                      {timeAgo(e.created_at)} · {profileName(e.created_by)}
                    </p>
                  </li>
                ))}
              </ol>
            </SectionCard>
          )}

          {tab === "Notes" && (
            <SectionCard title="Notes" description="Notes are saved to this lead's timeline">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Write a note…"
                className="h-24 w-full resize-none rounded-xl border border-border bg-surface p-3 text-sm outline-none placeholder:text-subtle focus:border-primary/40"
              />
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={saveNote}
                  disabled={createActivity.isPending || !noteText.trim()}
                  className="rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                >
                  Save note
                </button>
              </div>
              <ul className="mt-6 space-y-4">
                {(activities.data ?? [])
                  .filter((a) => a.type === "note")
                  .map((n) => (
                    <li key={n.id} className="rounded-xl border border-border bg-surface p-4">
                      <p className="text-sm text-foreground">{n.content}</p>
                      <p className="mt-2 text-xs text-subtle">
                        {profileName(n.created_by)} · {timeAgo(n.created_at)}
                      </p>
                    </li>
                  ))}
              </ul>
            </SectionCard>
          )}

          {tab === "Tasks" && (
            <SectionCard title="Lead tasks" description="Tasks linked to this lead">
              <div className="mb-4 flex items-center gap-2">
                <input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="New task title…"
                  className="h-10 flex-1 rounded-xl border border-border bg-surface px-3 text-sm outline-none placeholder:text-subtle focus:border-primary/40"
                />
                <button
                  onClick={addTask}
                  disabled={createTask.isPending || !taskTitle.trim()}
                  className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  Add
                </button>
              </div>
              {leadTasks.length === 0 && (
                <p className="text-sm text-subtle">No tasks yet for this lead.</p>
              )}
              <ul className="space-y-3">
                {leadTasks.map((t) => (
                  <li
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{t.title}</p>
                      <p className="mt-1 text-xs text-subtle">{t.assignee}</p>
                    </div>
                    <div className="flex items-center gap-2">
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
                      <Pill tone="info">{t.status}</Pill>
                      <span className="text-xs text-subtle">{t.due}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {(tab === "WhatsApp" || tab === "Telegram" || tab === "Email") && (
            <SectionCard title={tab} description="Integrated messaging">
              <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-subtle">
                {tab} isn't connected yet. Add your API keys in Settings → Integrations to enable
                messaging from here.
              </div>
            </SectionCard>
          )}
        </div>

        {/* RIGHT — AI + quick actions */}
        <div className="space-y-6">
          <SectionCard
            title="Lead score"
            description="Manual score — adjust as the deal progresses"
          >
            <div className="flex items-end gap-3">
              <p className="text-4xl font-semibold tracking-tight text-foreground">{lead.score}</p>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-success" style={{ width: `${lead.score}%` }} />
            </div>
          </SectionCard>

          <SectionCard title="AI assistant" description="Context-aware for this lead">
            <div className="rounded-xl bg-mint p-4 text-sm text-mint-foreground">
              <Bot className="mb-2 h-4 w-4" />
              Open the AI Copilot (top bar) and ask about {lead.name} — it can draft follow-ups,
              summarize notes and suggest next actions.
            </div>
            <div className="mt-4 grid gap-2">
              {AI_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  className="rounded-xl border border-border px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Upcoming tasks">
            {upcoming.length === 0 && <p className="text-sm text-subtle">Nothing scheduled yet.</p>}
            <ul className="space-y-3">
              {upcoming.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5"
                >
                  <CalendarClock className="h-4 w-4 text-subtle" />
                  <div>
                    <p className="text-sm font-medium">{t.title}</p>
                    <p className="text-xs text-subtle">{t.due}</p>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
