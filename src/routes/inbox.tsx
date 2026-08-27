import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
  const navigate = useNavigate();

  function open(n: (typeof notifications)[number]) {
    if (n.unread) markRead.mutate(n.id);
    if (n.link) void navigate({ to: n.link });
  }

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

      {rows.length === 0 && !isLoading ? (
        <SectionCard>
          <p className="py-10 text-center text-sm text-muted-foreground">{t("inbox.empty")}</p>
        </SectionCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((n) => (
            <div
              key={n.id}
              onClick={() => open(n)}
              className={cn(
                "flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-soft transition-colors hover:border-primary/40",
                (n.unread || n.link) && "cursor-pointer",
                n.unread && "bg-mint/10",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <Pill tone={n.type === "Overdue" ? "danger" : n.type === "AI" ? "info" : "neutral"}>
                  {n.type}
                </Pill>
                <div className="flex shrink-0 items-center gap-1.5">
                  {n.unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                  <span className="text-[11px] text-subtle">{n.meta}</span>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{n.title}</p>
                {n.body && <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>}
              </div>
              {n.link && (
                <span className="self-start text-xs font-semibold text-primary">
                  {t("inbox.open")}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
