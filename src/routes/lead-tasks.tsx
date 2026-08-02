import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, SectionCard, Pill } from "@/components/layout/Primitives";
import { LEADS, currency } from "@/lib/mock-data";

export const Route = createFileRoute("/lead-tasks")({
  head: () => ({
    meta: [
      { title: "Lead Tasks — SalesOS Elite" },
      { name: "description", content: "Tasks attached to CRM leads with timeline, status, owner, deadlines and files." },
      { property: "og:title", content: "Lead Tasks — SalesOS Elite" },
      { property: "og:description", content: "Lead-level tasks with full activity timeline." },
    ],
  }),
  component: LeadTasks,
});

const TIMELINE = [
  { at: "Today, 09:14", text: "Proposal v2 uploaded", who: "Aizhan Serikova" },
  { at: "Yesterday, 16:40", text: "Discovery call completed — 18 min", who: "Aizhan Serikova" },
  { at: "Yesterday, 11:02", text: "Stage moved Proposal → Negotiation", who: "Automation" },
  { at: "2 days ago", text: "Task created: send security questionnaire", who: "Daniyar Omarov" },
];

function LeadTasks() {
  return (
    <>
      <PageHeader title="Lead Tasks" description="Every open action item, anchored to the lead it belongs to." />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {LEADS.slice(0, 4).map((l) => (
            <SectionCard
              key={l.id}
              title={l.company}
              description={`${l.contact} · ${l.owner} · ${currency(l.value)}`}
              actions={<Pill tone={l.stage === "Won" ? "success" : "info"}>{l.stage}</Pill>}
            >
              <ul className="space-y-3">
                {["Send revised proposal", "Book technical deep dive", "Confirm procurement contact"].map((task, i) => (
                  <li key={task} className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="h-2 w-2 rounded-full bg-primary" />
                      <span className="text-sm font-medium">{task}</span>
                    </div>
                    <span className="text-xs text-subtle">{i === 0 ? "Overdue 1d" : `Due in ${i + 2}d`}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          ))}
        </div>

        <SectionCard title="Activity timeline" description="Kazpost Digital">
          <ol className="relative space-y-6 border-l border-border pl-5">
            {TIMELINE.map((e) => (
              <li key={e.at} className="relative">
                <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
                <p className="text-sm font-medium text-foreground">{e.text}</p>
                <p className="mt-1 text-xs text-subtle">{e.at} · {e.who}</p>
              </li>
            ))}
          </ol>
        </SectionCard>
      </div>
    </>
  );
}
