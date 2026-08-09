import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, Bell, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionCard, StatCard, Pill } from "@/components/layout/Primitives";
import { useCurrency } from "@/lib/currency";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  useAiAssistantChat,
  useCreateNotification,
  useCrmLeads,
  useNormativesView,
  type NormativeRow,
} from "@/hooks/use-crm-data";

export const Route = createFileRoute("/normatives")({
  head: () => ({
    meta: [
      { title: "Normativlar — SalesOS Elite" },
      {
        name: "description",
        content: "Sales quota tracking, underperformer alerts and pipeline bottleneck diagnostics.",
      },
    ],
  }),
  component: NormativesPage,
});

const statusTone: Record<NormativeRow["status"], "success" | "warning" | "danger"> = {
  onTrack: "success",
  atRisk: "warning",
  behind: "danger",
};

function CoachButton({ row }: { row: NormativeRow }) {
  const { t } = useI18n();
  const { format } = useCurrency();
  const chat = useAiAssistantChat();
  const [tip, setTip] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function onClick() {
    setOpen(true);
    if (tip) return;
    try {
      const reply = await chat.mutateAsync([
        {
          role: "user",
          content: `Employee ${row.name} (${row.department}) is at ${row.monthlyPct}% of their monthly sales target (${format(row.revenueMonth)} of ${format(row.monthlyTarget)}), pacing at ${row.pacePct}% of where they should be by today. Give one short, specific, actionable coaching tip (2-3 sentences) to help them hit target this month.`,
        },
      ]);
      setTip(reply);
    } catch (err) {
      setTip(err instanceof Error ? err.message : t("normatives.coachFailed"));
    }
  }

  return (
    <div>
      <button
        onClick={onClick}
        disabled={chat.isPending}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/15 disabled:opacity-60"
      >
        {chat.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        {t("normatives.aiCoach")}
      </button>
      {open && tip && (
        <p className="mt-2 max-w-xs rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs text-foreground">
          {tip}
        </p>
      )}
    </div>
  );
}

function NotifyButton({ row }: { row: NormativeRow }) {
  const { t } = useI18n();
  const createNotification = useCreateNotification();
  const [sent, setSent] = useState(false);

  async function onClick() {
    try {
      await createNotification.mutateAsync({
        user_id: row.profileId,
        type: "Normative",
        title: t("normatives.notifyTitle"),
        body: t("normatives.notifyBody", { pct: row.monthlyPct }),
      });
      setSent(true);
      toast.success(t("normatives.notifySent"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("normatives.notifyFailed"));
    }
  }

  return (
    <button
      onClick={onClick}
      disabled={createNotification.isPending || sent}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent disabled:opacity-60"
    >
      {createNotification.isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Bell className="h-3.5 w-3.5" />
      )}
      {sent ? t("normatives.notifySent") : t("normatives.notify")}
    </button>
  );
}

function BottleneckCard() {
  const { t } = useI18n();
  const { rows: leads, stages } = useCrmLeads();

  const nonTerminal = stages.filter((s) => !s.is_won && !s.is_lost);
  const counted = nonTerminal
    .map((s) => ({ stage: s, count: leads.filter((l) => l.stageId === s.id).length }))
    .sort((a, b) => b.count - a.count);
  const bottleneck = counted[0];

  return (
    <SectionCard title={t("normatives.bottleneck")} description={t("normatives.bottleneckDesc")}>
      {bottleneck && bottleneck.count > 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-semibold text-foreground">{bottleneck.stage.name}</p>
            <p className="text-xs text-subtle">
              {t("normatives.bottleneckHint", { count: bottleneck.count })}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-subtle">{t("normatives.noBottleneck")}</p>
      )}
    </SectionCard>
  );
}

function NormativesPage() {
  const { t } = useI18n();
  const { format } = useCurrency();
  const { user } = useAuth();
  const canManage = user?.role === "super_admin" || user?.role === "manager";
  const { rows, isLoading } = useNormativesView();

  const onTrack = rows.filter((r) => r.status === "onTrack").length;
  const atRisk = rows.filter((r) => r.status === "atRisk").length;
  const behind = rows.filter((r) => r.status === "behind").length;

  return (
    <>
      <PageHeader title={t("normatives.title")} description={t("normatives.desc")} />

      {isLoading && (
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-3">
        <StatCard label={t("normatives.onTrack")} value={String(onTrack)} tone="mint" />
        <StatCard label={t("normatives.atRisk")} value={String(atRisk)} />
        <StatCard label={t("normatives.behind")} value={String(behind)} />
      </div>

      <div className="mt-6">
        <BottleneckCard />
      </div>

      <div className="mt-6">
        <SectionCard title={t("normatives.roster")} description={t("normatives.rosterDesc")}>
          <div className="-m-6 overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-subtle">
                  <th className="px-6 py-3 font-medium">{t("normatives.colEmployee")}</th>
                  <th className="px-6 py-3 font-medium">{t("normatives.colToday")}</th>
                  <th className="px-6 py-3 font-medium">{t("normatives.colMonth")}</th>
                  <th className="px-6 py-3 font-medium">{t("normatives.colProgress")}</th>
                  <th className="px-6 py-3 font-medium">{t("normatives.colStatus")}</th>
                  {canManage && (
                    <th className="px-6 py-3 font-medium">{t("normatives.colActions")}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.profileId}
                    className={cn(
                      "border-b border-border last:border-0 transition-colors hover:bg-surface",
                      r.status === "behind" && "bg-destructive/5",
                    )}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-mint text-xs font-semibold text-mint-foreground">
                          {r.initials}
                        </span>
                        <div>
                          <p className="font-medium text-foreground">{r.name}</p>
                          <p className="text-xs text-subtle">{r.department}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {format(r.revenueToday)} / {format(r.dailyTarget)}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {format(r.revenueMonth)} / {format(r.monthlyTarget)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              r.status === "behind"
                                ? "bg-destructive"
                                : r.status === "atRisk"
                                  ? "bg-warning"
                                  : "bg-success",
                            )}
                            style={{ width: `${Math.min(100, r.monthlyPct)}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold">{r.monthlyPct}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Pill tone={statusTone[r.status]}>{t(`normatives.status.${r.status}`)}</Pill>
                    </td>
                    {canManage && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <CoachButton row={r} />
                          {r.status !== "onTrack" && <NotifyButton row={r} />}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!isLoading && rows.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("normatives.noEmployees")}
            </p>
          )}
        </SectionCard>
      </div>
    </>
  );
}
