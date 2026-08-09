import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { PageHeader, SectionCard, Pill } from "@/components/layout/Primitives";
import { cn } from "@/lib/utils";
import { useMarkNotificationRead, useNotificationsView } from "@/hooks/use-crm-data";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/inbox")({
  head: () => ({
    meta: [
      { title: "Inbox — SalesOS Elite" },
      {
        name: "description",
        content: "Notification center for CRM alerts, assignments, overdue work and AI signals.",
      },
      { property: "og:title", content: "Inbox — SalesOS Elite" },
      { property: "og:description", content: "One notification center for the whole revenue org." },
    ],
  }),
  component: InboxPage,
});

const FILTERS = ["All", "Unread"] as const;

function InboxPage() {
  const { t } = useI18n();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const { rows: notifications, isLoading } = useNotificationsView();
  const markRead = useMarkNotificationRead();

  const rows = useMemo(
    () => (filter === "Unread" ? notifications.filter((n) => n.unread) : notifications),
    [notifications, filter],
  );

  const filterLabel: Record<(typeof FILTERS)[number], string> = {
    All: t("inbox.filterAll"),
    Unread: t("inbox.filterUnread"),
  };

  return (
    <>
      <PageHeader title={t("inbox.title")} description={t("inbox.desc")} />

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-medium transition-colors",
              filter === f
                ? "bg-foreground text-background"
                : "border border-border bg-background text-muted-foreground hover:bg-accent",
            )}
          >
            {filterLabel[f]}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
        </div>
      )}

      <SectionCard>
        {rows.length === 0 && !isLoading && (
          <p className="py-10 text-center text-sm text-muted-foreground">{t("inbox.empty")}</p>
        )}
        <ul className="-m-6 divide-y divide-border">
          {rows.map((n) => (
            <li
              key={n.id}
              onClick={() => n.unread && markRead.mutate(n.id)}
              className={cn(
                "flex items-start gap-4 px-6 py-5 transition-colors hover:bg-surface",
                n.unread && "cursor-pointer bg-mint/40",
              )}
            >
              <span
                className={cn(
                  "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                  n.unread ? "bg-primary" : "bg-border",
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{n.title}</p>
                {n.body && <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-xs text-subtle">{n.meta}</p>
              </div>
              <Pill tone={n.type === "Overdue" ? "danger" : n.type === "AI" ? "info" : "neutral"}>
                {n.type}
              </Pill>
            </li>
          ))}
        </ul>
      </SectionCard>
    </>
  );
}
