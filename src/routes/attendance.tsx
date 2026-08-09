import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, Phone, PhoneOff, PlayCircle, StopCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionCard, StatCard } from "@/components/layout/Primitives";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  useAttendanceView,
  useClockIn,
  useClockOut,
  useLogCall,
  useMyOpenSession,
} from "@/hooks/use-crm-data";

export const Route = createFileRoute("/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance — SalesOS Elite" },
      {
        name: "description",
        content: "Clock in/out and call activity, logged per employee, per day.",
      },
    ],
  }),
  component: AttendancePage,
});

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

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

function AttendancePage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const canManage = user?.role === "super_admin" || user?.role === "manager";
  const { rows, isLoading } = useAttendanceView();

  const visible = canManage ? rows : rows.filter((r) => r.profileId === user?.id);
  const totalCalls = visible.reduce((s, r) => s + r.callsMade, 0);
  const totalConnected = visible.reduce((s, r) => s + r.callsConnected, 0);
  const totalCallMinutes = visible.reduce((s, r) => s + r.totalCallMinutes, 0);

  return (
    <>
      <PageHeader title={t("attendance.title")} description={t("attendance.desc")} />

      <div className="grid gap-6 xl:grid-cols-2">
        <MyStatusCard />
        <LogCallCard />
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-3">
        <StatCard label={t("attendance.colCalls")} value={String(totalCalls)} tone="mint" />
        <StatCard label={t("attendance.colConnected")} value={String(totalConnected)} />
        <StatCard
          label={t("attendance.colCallTime")}
          value={`${totalCallMinutes} ${t("attendance.minutesShort")}`}
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
    </>
  );
}
