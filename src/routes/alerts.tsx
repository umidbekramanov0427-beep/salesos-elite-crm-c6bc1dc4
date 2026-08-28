import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Flag, Loader2, MicOff, ShieldAlert, TrendingDown, UserX } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionCard, Pill } from "@/components/layout/Primitives";
import { FilterSelect } from "@/components/filters/FilterSelect";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import {
  useAlertsView,
  useDismissAlert,
  useMarkAlertRead,
  type AlertType,
  type AlertView,
} from "@/hooks/use-crm-data";

function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
    return err.message || fallback;
  }
  return fallback;
}

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Ogohlantirishlar — SalesOS Elite" },
      {
        name: "description",
        content: "Operational alerts: inactive reps, missing recordings, low-scored calls, risks.",
      },
    ],
  }),
  component: AlertsPage,
});

const TABS = ["all", "new", "read", "dismissed"] as const;
type Tab = (typeof TABS)[number];

const TYPE_ICON: Record<AlertType, React.ComponentType<{ className?: string }>> = {
  manager_inactive: UserX,
  no_audio: MicOff,
  low_quality: TrendingDown,
  red_flag: Flag,
};

const TYPE_TONE: Record<AlertType, "warning" | "info" | "danger"> = {
  manager_inactive: "warning",
  no_audio: "info",
  low_quality: "warning",
  red_flag: "danger",
};

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function AlertsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (user && user.role !== "super_admin" && user.role !== "platform_owner") {
    return (
      <SectionCard title={t("admin.restrictedTitle")} description={t("admin.restrictedDesc")}>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <ShieldAlert className="h-4 w-4" /> {t("admin.restrictedHint")}
        </div>
      </SectionCard>
    );
  }

  return <AlertsPageContent />;
}

function AlertsPageContent() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { alerts, isLoading } = useAlertsView();
  const markRead = useMarkAlertRead();
  const dismiss = useDismissAlert();
  const [tab, setTab] = useState<Tab>("all");
  const [typeFilter, setTypeFilter] = useState<AlertType | "">("");

  const tabLabel: Record<Tab, string> = {
    all: t("alerts.tabAll"),
    new: t("alerts.tabNew"),
    read: t("alerts.tabRead"),
    dismissed: t("alerts.tabDismissed"),
  };

  const byTab = useMemo(() => {
    return alerts.filter((a) => {
      if (tab === "dismissed") return a.dismissed;
      if (a.dismissed) return false;
      if (tab === "new") return !a.read;
      if (tab === "read") return a.read;
      return true;
    });
  }, [alerts, tab]);

  const rows = useMemo(
    () => (typeFilter ? byTab.filter((a) => a.type === typeFilter) : byTab),
    [byTab, typeFilter],
  );

  function open(a: AlertView) {
    if (!a.read) {
      markRead.mutate(a.key, {
        onError: (err) => toast.error(errorMessage(err, t("alerts.actionFailed"))),
      });
    }
    if (a.link) void navigate({ to: a.link });
  }

  return (
    <>
      <PageHeader title={t("alerts.title")} description={t("alerts.desc")} />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tb) => (
            <button
              key={tb}
              onClick={() => setTab(tb)}
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-medium transition-colors",
                tab === tb
                  ? "bg-foreground text-background"
                  : "border border-border bg-background text-muted-foreground hover:bg-accent",
              )}
            >
              {tabLabel[tb]}
            </button>
          ))}
        </div>
        <FilterSelect
          icon={Flag}
          label={t("alerts.typeLabel")}
          value={typeFilter}
          onChange={(v) => setTypeFilter(v as AlertType | "")}
          className="w-56"
        >
          <option value="">{t("alerts.filterAllTypes")}</option>
          {(Object.keys(TYPE_ICON) as AlertType[]).map((tp) => (
            <option key={tp} value={tp}>
              {t(`alerts.type.${tp}`)}
            </option>
          ))}
        </FilterSelect>
      </div>

      {isLoading && (
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
        </div>
      )}

      {rows.length === 0 && !isLoading ? (
        <SectionCard>
          <p className="py-10 text-center text-sm text-muted-foreground">{t("alerts.empty")}</p>
        </SectionCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rows.map((a) => {
            const Icon = TYPE_ICON[a.type];
            const tone = TYPE_TONE[a.type];
            const borderTone = {
              warning: "border-l-warning",
              info: "border-l-primary",
              danger: "border-l-destructive",
            }[tone];
            return (
              <div
                key={a.key}
                className={cn(
                  "flex flex-col gap-3 rounded-2xl border border-border border-l-4 bg-card p-5 shadow-soft transition-colors",
                  borderTone,
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <Pill tone={tone === "info" ? "info" : tone === "danger" ? "danger" : "warning"}>
                    <Icon className="mr-1 h-3 w-3" /> {t(`alerts.type.${a.type}`)}
                  </Pill>
                  <span className="shrink-0 text-xs text-subtle">
                    {formatDateTime(a.createdAt)}
                  </span>
                </div>
                <div
                  onClick={() => open(a)}
                  className={cn("min-w-0 flex-1", a.link && "cursor-pointer")}
                >
                  <p className="text-sm font-semibold text-foreground">{a.title}</p>
                  {a.body && <p className="mt-1 text-xs text-muted-foreground">{a.body}</p>}
                </div>
                <div className="flex items-center justify-between gap-2">
                  {a.link ? (
                    <button
                      onClick={() => open(a)}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      {t("inbox.open")}
                    </button>
                  ) : (
                    <span />
                  )}
                  {!a.dismissed && (
                    <button
                      onClick={() =>
                        dismiss.mutate(a.key, {
                          onError: (err) =>
                            toast.error(errorMessage(err, t("alerts.actionFailed"))),
                        })
                      }
                      className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      {t("alerts.dismiss")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
