import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft, Bot, CalendarClock, FileText, MessageCircle, Mail, Phone, Send, Sparkles, Paperclip,
} from "lucide-react";
import { SectionCard, Pill } from "@/components/layout/Primitives";
import {
  AI_SUGGESTIONS, CRM_LEADS, LEAD_CALLS, LEAD_FILES, LEAD_MESSAGES, LEAD_NOTES,
  LEAD_TASKS_DETAIL, LEAD_TIMELINE,
} from "@/lib/crm-data";
import { currency } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/crm/leads/$leadId")({
  loader: ({ params }) => {
    const lead = CRM_LEADS.find((l) => l.id === params.leadId);
    if (!lead) throw notFound();
    return { lead };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Lead not found — SalesOS Elite" }, { name: "robots", content: "noindex" }] };
    }
    const { lead } = loaderData;
    return {
      meta: [
        { title: `${lead.name} · ${lead.company} — SalesOS Elite CRM` },
        { name: "description", content: `Full CRM workspace for ${lead.name} at ${lead.company}: timeline, tasks, calls, files, messaging and AI assistance.` },
        { property: "og:title", content: `${lead.name} · ${lead.company}` },
        { property: "og:description", content: "Lead workspace with timeline, activities and AI assistance." },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  notFoundComponent: LeadNotFound,
  errorComponent: LeadNotFound,
  component: LeadWorkspace,
});

function LeadNotFound() {
  return (
    <SectionCard title="Lead unavailable" description="This lead does not exist or was archived.">
      <Link to="/crm/leads" className="text-sm font-semibold text-primary">Back to leads</Link>
    </SectionCard>
  );
}

const TABS = ["Timeline", "Activities", "Notes", "Calls", "Tasks", "Files", "WhatsApp", "Telegram", "Email"] as const;

function LeadWorkspace() {
  const { lead } = Route.useLoaderData();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Timeline");

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/crm/leads" className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-accent" aria-label="Back to leads">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint text-sm font-semibold text-mint-foreground">
            {lead.initials}
          </span>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{lead.name}</h1>
            <p className="text-sm text-muted-foreground">
              {lead.position} · {lead.company} · {lead.id}
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
            <button key={a.label} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-medium text-muted-foreground hover:bg-accent">
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
                ["Phone", lead.phone], ["Additional phone", lead.altPhone], ["Email", lead.email],
                ["Telegram", lead.telegram], ["WhatsApp", lead.whatsapp], ["Source", lead.source],
                ["Campaign", lead.campaign], ["Owner", lead.owner], ["Manager", lead.manager],
                ["Priority", lead.priority], ["Budget", currency(lead.budget)],
                ["Expected revenue", currency(lead.expectedRevenue)], ["Funnel", lead.funnel],
                ["Next follow up", lead.nextFollowUp], ["Last contact", lead.lastContact],
                ["Created", lead.created], ["Updated", lead.updated],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-3">
                  <dt className="text-subtle">{k}</dt>
                  <dd className="text-right font-medium text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </SectionCard>

          <SectionCard title="Location">
            <p className="text-sm text-muted-foreground">{lead.address}</p>
            <p className="mt-1 text-sm text-muted-foreground">{lead.city}, {lead.region}</p>
            <p className="mt-1 text-sm text-muted-foreground">{lead.country}</p>
          </SectionCard>

          <SectionCard title="Tags & custom fields">
            <div className="flex flex-wrap gap-2">
              {lead.tags.map((t: string) => <Pill key={t}>{t}</Pill>)}
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-subtle">UTM</span><span className="max-w-[160px] truncate font-medium">{lead.utm}</span></div>
              <div className="flex justify-between"><span className="text-subtle">Contract type</span><span className="font-medium">Annual</span></div>
              <div className="flex justify-between"><span className="text-subtle">Legal entity</span><span className="font-medium">LLP</span></div>
            </div>
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
                  tab === t ? "bg-background text-foreground shadow-soft" : "text-muted-foreground hover:bg-accent",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {(tab === "Timeline" || tab === "Activities") && (
            <SectionCard title={tab} description="Every recorded event on this lead" actions={
              <input placeholder="Search timeline" className="h-9 w-44 rounded-xl border border-border bg-surface px-3 text-sm outline-none placeholder:text-subtle focus:border-primary/40" />
            }>
              <ol className="relative space-y-6 border-l border-border pl-5">
                {LEAD_TIMELINE.map((e) => (
                  <li key={e.at + e.text} className="relative">
                    <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={e.type === "AI" ? "success" : "info"}>{e.type}</Pill>
                      <p className="text-sm font-medium text-foreground">{e.text}</p>
                    </div>
                    <p className="mt-1 text-xs text-subtle">{e.at} · {e.who}</p>
                  </li>
                ))}
              </ol>
            </SectionCard>
          )}

          {tab === "Notes" && (
            <SectionCard title="Notes" description="Rich notes with mentions and history">
              <textarea
                placeholder="Write a note… use @ to mention a teammate"
                className="h-24 w-full resize-none rounded-xl border border-border bg-surface p-3 text-sm outline-none placeholder:text-subtle focus:border-primary/40"
              />
              <div className="mt-3 flex items-center gap-2">
                <button className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent">
                  <Paperclip className="h-3.5 w-3.5" /> Attach
                </button>
                <button className="rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Save note</button>
              </div>
              <ul className="mt-6 space-y-4">
                {LEAD_NOTES.map((n) => (
                  <li key={n.at} className="rounded-xl border border-border bg-surface p-4">
                    <p className="text-sm text-foreground">{n.text}</p>
                    <p className="mt-2 text-xs text-subtle">{n.author} · {n.at}</p>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {tab === "Calls" && (
            <SectionCard title="Call history" description="Recordings, transcripts and AI analysis">
              <ul className="space-y-3">
                {LEAD_CALLS.map((c) => (
                  <li key={c.id} className="rounded-xl border border-border bg-surface p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Pill tone={c.direction === "Missed" ? "danger" : "info"}>{c.direction}</Pill>
                        <span className="text-sm font-medium">{c.at}</span>
                        <span className="text-xs text-subtle">{c.duration}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-subtle">Sentiment</span>
                        <Pill tone={c.sentiment === "Positive" ? "success" : c.sentiment === "Neutral" ? "warning" : "neutral"}>
                          {c.sentiment}
                        </Pill>
                        <span className="font-semibold">{c.score || "—"}</span>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{c.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {c.keywords.map((k) => <Pill key={k}>{k}</Pill>)}
                    </div>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {tab === "Tasks" && (
            <SectionCard title="Lead tasks" description="Unlimited tasks with checklists and reminders">
              <ul className="space-y-3">
                {LEAD_TASKS_DETAIL.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{t.title}</p>
                      <p className="mt-1 text-xs text-subtle">{t.type} · {t.assignee} · checklist {t.checklist}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pill tone={t.priority === "Urgent" ? "danger" : t.priority === "High" ? "warning" : "neutral"}>{t.priority}</Pill>
                      <Pill tone="info">{t.status}</Pill>
                      <span className="text-xs text-subtle">{t.due}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {tab === "Files" && (
            <SectionCard title="Files" description="Drag & drop upload with version history">
              <div className="mb-4 rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-subtle">
                Drop files here — PDF, Word, Excel, image, video, audio, ZIP
              </div>
              <ul className="space-y-2">
                {LEAD_FILES.map((f) => (
                  <li key={f.name} className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-subtle" />
                      <div>
                        <p className="text-sm font-medium">{f.name}</p>
                        <p className="text-xs text-subtle">{f.type} · {f.size} · {f.version} · {f.at}</p>
                      </div>
                    </div>
                    <button className="text-xs font-semibold text-primary">Download</button>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {(tab === "WhatsApp" || tab === "Telegram") && (
            <SectionCard title={tab} description="Integrated chat with templates and AI replies">
              <div className="space-y-3">
                {(tab === "WhatsApp" ? LEAD_MESSAGES.whatsapp : LEAD_MESSAGES.telegram).map((m, i) => (
                  <div key={i} className={cn("flex", m.from === "us" ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[70%] rounded-2xl px-4 py-2 text-sm",
                      m.from === "us" ? "bg-mint text-mint-foreground" : "bg-surface text-foreground border border-border",
                    )}>
                      {m.text}
                      <span className="ml-2 text-[10px] text-subtle">{m.at}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2">
                <input placeholder="Type a message…" className="h-10 flex-1 rounded-xl border border-border bg-surface px-3 text-sm outline-none placeholder:text-subtle focus:border-primary/40" />
                <button className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Send</button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {["Use template", "Attach file", "Voice message", "AI reply suggestion"].map((a) => (
                  <button key={a} className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent">{a}</button>
                ))}
              </div>
            </SectionCard>
          )}

          {tab === "Email" && (
            <SectionCard title="Email" description="Inbox, outbox, templates and tracking">
              <ul className="space-y-2">
                {LEAD_MESSAGES.email.map((m) => (
                  <li key={m.subject + m.at} className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{m.subject}</p>
                      <p className="text-xs text-subtle">{m.from === "us" ? "Outbox" : "Inbox"} · {m.at}</p>
                    </div>
                    <Pill tone={m.status === "Replied" ? "success" : "info"}>{m.status}</Pill>
                  </li>
                ))}
              </ul>
              <button className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
                <Sparkles className="h-4 w-4" /> Compose with AI writer
              </button>
            </SectionCard>
          )}
        </div>

        {/* RIGHT — AI + quick actions */}
        <div className="space-y-6">
          <SectionCard title="Lead score" description="Predicted close probability">
            <div className="flex items-end gap-3">
              <p className="text-4xl font-semibold tracking-tight text-foreground">{lead.score}</p>
              <span className="pb-1 text-sm text-success">+6 this week</span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-success" style={{ width: `${lead.score}%` }} />
            </div>
            <p className="mt-3 text-xs text-subtle">Driven by engagement frequency, deal size and stage velocity.</p>
          </SectionCard>

          <SectionCard title="AI assistant" description="Context-aware for this lead">
            <div className="rounded-xl bg-mint p-4 text-sm text-mint-foreground">
              <Bot className="mb-2 h-4 w-4" />
              Security review is the only open blocker. Send the SOC2 pack today and propose a Thursday signature call — historically lifts close rate by 22%.
            </div>
            <div className="mt-4 grid gap-2">
              {AI_SUGGESTIONS.map((s) => (
                <button key={s} className="rounded-xl border border-border px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                  {s}
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Upcoming events">
            <ul className="space-y-3">
              {[
                { t: "Contract review call", d: "Today, 15:00" },
                { t: "Technical deep dive", d: "Thu, 11:00" },
                { t: "Procurement sign-off", d: "Mon, 09:30" },
              ].map((e) => (
                <li key={e.t} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
                  <CalendarClock className="h-4 w-4 text-subtle" />
                  <div>
                    <p className="text-sm font-medium">{e.t}</p>
                    <p className="text-xs text-subtle">{e.d}</p>
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
