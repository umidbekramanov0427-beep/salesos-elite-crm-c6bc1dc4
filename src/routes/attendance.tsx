import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Loader2,
  Phone,
  PhoneOff,
  PlayCircle,
  Sparkles,
  StopCircle,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionCard, StatCard, Pill } from "@/components/layout/Primitives";
import { useCurrency } from "@/lib/currency";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  useAiAssistantChat,
  useAsOfSnapshot,
  useAttendanceView,
  useClockIn,
  useClockOut,
  useCreateNotification,
  useCrmLeads,
  useLogCall,
  useMyOpenSession,
  useNormativesView,
  type CallLogRow,
  type NormativeRow,
  type WorkSessionRow,
} from "@/hooks/use-crm-data";
import { AsOfDatePicker, AsOfBanner } from "@/components/filters/AsOfDatePicker";

export const Route = createFileRoute("/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance & Quotas — SalesOS Elite" },
      {
        name: "description",
        content:
          "Clock in/out and call activity, plus quota pacing, underperformer alerts and pipeline bottleneck diagnostics.",
      },
    ],
  }),
  component: AttendanceAndNormativesPage,
});

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const statusTone: Record<NormativeRow["status"], "success" | "warning" | "danger"> = {
  onTrack: "success",
  atRisk: "warning",
  behind: "danger",
};

function MyStatusCard() {
  const { t } = useI18n();
  const { session, isLoading } = useMyOpenSession();
  const clockIn = useClockIn();
  const clockOut = useClockOut();

  async function onClockIn() {
    try {
      await clockIn.mutateAsync();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("attendance.clockInFailed"));
    }
  }

  async function onClockOut() {
    if (!session) return;
    try {
      await clockOut.mutateAsync(session.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("attendance.clockOutFailed"));
    }
  }

  const busy = clockIn.isPending || clockOut.isPending || isLoading;

  return (
    <SectionCard title={t("attendance.myStatus")}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl",
              session ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
            )}
          >
            {session ? <CheckCircle2 className="h-5 w-5" /> : <PlayCircle className="h-5 w-5" />}
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {session ? t("attendance.sessionActive") : t("attendance.notStartedYet")}
            </p>
            {session && (
              <p className="text-xs text-subtle">
                {t("attendance.clockIn")}: {formatTime(session.clock_in)}
              </p>
            )}
          </div>
        </div>
        {session ? (
          <button
            onClick={onClockOut}
            disabled={busy}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-destructive px-4 text-sm font-semibold text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {clockOut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <StopCircle className="h-4 w-4" />
            )}
            {t("attendance.clockOutAction")}
          </button>
        ) : (
          <button
            onClick={onClockIn}
            disabled={busy}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {clockIn.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}
            {t("attendance.clockInAction")}
          </button>
        )}
      </div>
    </SectionCard>
  );
}

function LogCallCard() {
  const { t } = useI18n();
  const logCall = useLogCall();
  const [phone, setPhone] = useState("");
  const [minutes, setMinutes] = useState("2");
  const [connected, setConnected] = useState(true);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await logCall.mutateAsync({
        phone: phone.trim(),
        connected,
        durationSeconds: Math.max(0, Math.round(Number(minutes) * 60)) || 0,
      });
      toast.success(t("attendance.callLogged"));
      setPhone("");
      setMinutes("2");
      setConnected(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("attendance.callLogFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard title={t("attendance.logCall")}>
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_120px_auto_auto]">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t("attendance.phoneOptional")}
          className="h-10 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary/40"
        />
        <input
          type="number"
          min={0}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          className="h-10 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary/40"
        />
        <button
          type="button"
          onClick={() => setConnected((c) => !c)}
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors",
            connected
              ? "border-success/30 bg-success/10 text-success"
              : "border-border text-muted-foreground hover:bg-accent",
          )}
        >
          {connected ? <Phone className="h-4 w-4" /> : <PhoneOff className="h-4 w-4" />}
          {connected ? t("attendance.callConnected") : t("attendance.callNotConnected")}
        </button>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("attendance.logButton")}
        </button>
      </form>
    </SectionCard>
  );
}

function AttendanceSection() {
  const { t } = useI18n();
  const { user } = useAuth();
  const canManage =
    user?.role === "super_admin" || user?.role === "rop" || user?.role === "platform_owner";
  const [asOfDate, setAsOfDate] = useState<Date | null>(null);
  const asOfSessions = useAsOfSnapshot<WorkSessionRow>("work_sessions", asOfDate);
  const asOfCalls = useAsOfSnapshot<CallLogRow>("call_logs", asOfDate);
  const { rows, isLoading: rowsLoading } = useAttendanceView(
    asOfDate,
    asOfDate ? { sessions: asOfSessions.data ?? [], calls: asOfCalls.data ?? [] } : undefined,
  );
  const isLoading =
    rowsLoading || (asOfDate ? asOfSessions.isLoading || asOfCalls.isLoading : false);

  const visible =
    user?.role === "super_admin" || user?.role === "platform_owner"
      ? rows
      : user?.role === "rop"
        ? rows.filter((r) => r.managerId === user.id)
        : rows.filter((r) => r.profileId === user?.id);
  const totalCalls = visible.reduce((s, r) => s + r.callsMade, 0);
  const totalConnected = visible.reduce((s, r) => s + r.callsConnected, 0);
  const totalCallMinutes = visible.reduce((s, r) => s + r.totalCallMinutes, 0);

  return (
    <section className="surface-card p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600">
            <Clock className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-foreground">{t("nav./attendance")}</h2>
          </div>
        </div>
        <AsOfDatePicker value={asOfDate} onChange={setAsOfDate} />
      </div>

      <AsOfBanner value={asOfDate} />

      <div className="grid gap-6 xl:grid-cols-2">
        <MyStatusCard />
        <LogCallCard />
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-3">
        <StatCard
          label={t("attendance.colCalls")}
          value={String(totalCalls)}
          info={t("attendance.colCallsInfo")}
          tone="mint"
        />
        <StatCard
          label={t("attendance.colConnected")}
          value={String(totalConnected)}
          info={t("attendance.colConnectedInfo")}
        />
        <StatCard
          label={t("attendance.colCallTime")}
          value={`${totalCallMinutes} ${t("attendance.minutesShort")}`}
          info={t("attendance.colCallTimeInfo")}
        />
      </div>

      <div className="mt-6">
        <SectionCard title={t("attendance.roster")} description={t("attendance.rosterDesc")}>
          {isLoading && (
            <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
            </div>
          )}
          <div className="-m-6 overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-subtle">
                  <th className="px-6 py-3 font-medium">{t("attendance.colEmployee")}</th>
                  <th className="px-6 py-3 font-medium">{t("attendance.colClockIn")}</th>
                  <th className="px-6 py-3 font-medium">{t("attendance.colClockOut")}</th>
                  <th className="px-6 py-3 font-medium">{t("attendance.colSession")}</th>
                  <th className="px-6 py-3 font-medium">{t("attendance.colCalls")}</th>
                  <th className="px-6 py-3 font-medium">{t("attendance.colConnected")}</th>
                  <th className="px-6 py-3 font-medium">{t("attendance.colCallTime")}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr
                    key={r.profileId}
                    className="border-b border-border last:border-0 transition-colors hover:bg-surface"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-mint text-xs font-semibold text-mint-foreground">
                          {r.initials}
                        </span>
                        <div>
                          <p className="font-medium text-foreground">{r.name}</p>
                          <p className="text-xs text-subtle">{r.position}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{formatTime(r.clockIn)}</td>
                    <td className="px-6 py-4 text-muted-foreground">{formatTime(r.clockOut)}</td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {r.sessionMinutes} {t("attendance.minutesShort")}
                    </td>
                    <td className="px-6 py-4 font-medium">{r.callsMade}</td>
                    <td className="px-6 py-4 font-medium">{r.callsConnected}</td>
                    <td className="px-6 py-4 font-medium">
                      {r.totalCallMinutes} {t("attendance.minutesShort")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!isLoading && visible.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("attendance.noSession")}
            </p>
          )}
        </SectionCard>
      </div>
    </section>
  );
}

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
      const reply = await chat.mutateAsync({
        messages: [
          {
            role: "user",
            content: `Employee ${row.name} (${row.department}) is at ${row.monthlyPct}% of their monthly sales target (${format(row.revenueMonth)} of ${format(row.monthlyTarget)}), pacing at ${row.pacePct}% of where they should be by today. Give one short, specific, actionable coaching tip (2-3 sentences) to help them hit target this month.`,
          },
        ],
      });
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

function NormativesSection() {
  const { t } = useI18n();
  const { format } = useCurrency();
  const { user } = useAuth();
  const canManage =
    user?.role === "super_admin" || user?.role === "rop" || user?.role === "platform_owner";
  const { rows, isLoading } = useNormativesView();

  const onTrack = rows.filter((r) => r.status === "onTrack").length;
  const atRisk = rows.filter((r) => r.status === "atRisk").length;
  const behind = rows.filter((r) => r.status === "behind").length;

  return (
    <section className="surface-card p-6 sm:p-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600">
          <Target className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-foreground">{t("normatives.title")}</h2>
        </div>
      </div>

      {isLoading && (
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-3">
        <StatCard
          label={t("normatives.onTrack")}
          value={String(onTrack)}
          info={t("normatives.onTrackInfo")}
          tone="mint"
        />
        <StatCard
          label={t("normatives.atRisk")}
          value={String(atRisk)}
          info={t("normatives.atRiskInfo")}
        />
        <StatCard
          label={t("normatives.behind")}
          value={String(behind)}
          info={t("normatives.behindInfo")}
        />
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
    </section>
  );
}

function AttendanceAndNormativesPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t("attendance.title")} description={t("attendance.desc")} />
      <div className="space-y-8">
        <AttendanceSection />
        <NormativesSection />
      </div>
    </>
  );
}
