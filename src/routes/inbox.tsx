import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, SectionCard, Pill } from "@/components/layout/Primitives";
import { NOTIFICATIONS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/inbox")({
  head: () => ({
    meta: [
      { title: "Inbox — SalesOS Elite" },
      { name: "description", content: "Notification center for CRM alerts, mentions, assignments, overdue work and AI signals." },
      { property: "og:title", content: "Inbox — SalesOS Elite" },
      { property: "og:description", content: "One notification center for the whole revenue org." },
    ],
  }),
  component: InboxPage,
});

const FILTERS = ["All", "Unread", "Mentions", "Assignments", "Automation", "AI"];

function InboxPage() {
  return (
    <>
      <PageHeader title="Inbox" description="Everything that needs your attention, ranked by urgency." />

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f, i) => (
          <button
            key={f}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-medium transition-colors",
              i === 0 ? "bg-foreground text-background" : "border border-border bg-background text-muted-foreground hover:bg-accent",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <SectionCard>
        <ul className="-m-6 divide-y divide-border">
          {NOTIFICATIONS.map((n) => (
            <li key={n.id} className={cn("flex items-start gap-4 px-6 py-5 transition-colors hover:bg-surface", n.unread && "bg-mint/40")}>
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.unread ? "bg-primary" : "bg-border")} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{n.title}</p>
                <p className="mt-1 text-xs text-subtle">{n.meta}</p>
              </div>
              <Pill tone={n.type === "Overdue" ? "danger" : n.type === "AI" ? "info" : "neutral"}>{n.type}</Pill>
            </li>
          ))}
        </ul>
      </SectionCard>
    </>
  );
}
