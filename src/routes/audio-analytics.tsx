import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Loader2,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionCard, StatCard, Pill } from "@/components/layout/Primitives";
import { TagChip } from "@/components/crm/tag-editor";
import { useI18n, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  useAiAssistantChat,
  useAmoCrmLink,
  useAnalyzeCall,
  useAsOfSnapshot,
  useAudioAnalyticsView,
  useCrmLeads,
  useUploadManualCall,
  type AmoCrmCallRow,
  type AudioCallView,
  type RecoverableLeadView,
} from "@/hooks/use-crm-data";
import { AsOfDatePicker, AsOfBanner } from "@/components/filters/AsOfDatePicker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PermissionGate } from "@/components/PermissionGate";

export const Route = createFileRoute("/audio-analytics")({
  head: () => ({
    meta: [
      { title: "Audio Analytics — SalesOS Elite" },
      {
        name: "description",
        content: "Real call activity synced from AmoCRM: volume, connection rate, duration.",
      },
      { property: "og:title", content: "Audio Analytics — SalesOS Elite" },
      { property: "og:description", content: "Real call activity per rep, from AmoCRM." },
    ],
  }),
  component: AudioAnalyticsGated,
});

function AudioAnalyticsGated() {
  return (
    <PermissionGate action="View recordings">
      <AudioAnalytics />
    </PermissionGate>
  );
}

const LANG_NAME: Record<Lang, string> = { uz: "o'zbek", ru: "русский", en: "English" };

function formatDuration(seconds: number, min: string): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")} ${min}`;
}

function DailyReportCard({
  callsToday,
  connectionRate,
  avgDuration,
  connected,
}: {
  callsToday: number;
  connectionRate: number;
  avgDuration: number;
  connected: number;
}) {
  const { t, lang } = useI18n();
  const chat = useAiAssistantChat();
  const [report, setReport] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const reply = await chat.mutateAsync({
        messages: [
          {
            role: "user",
            content: `Here are today's real sales call numbers: ${callsToday} calls made, ${connected} connected, connection rate ${connectionRate}%, average call duration ${avgDuration} seconds. Write a short daily report (3-5 sentences): what the numbers suggest went well today and what should improve, and one concrete thing to focus on tomorrow. Only reason from these numbers — don't invent call content you don't have. Respond in ${LANG_NAME[lang]}.`,
          },
        ],
      });
      setReport(reply);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("audio.dailyReportFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard
      title={t("audio.dailyReport")}
      description={t("audio.dailyReportDesc")}
      actions={
        <button
          type="button"
          onClick={() => void generate()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-mint px-3 py-1.5 text-xs font-semibold text-mint-foreground transition-colors hover:bg-mint-border disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {t("common.generate")}
        </button>
      }
    >
      {report ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {report}
        </p>
      ) : (
        <p className="flex items-center gap-2 text-sm text-subtle">
          <Sparkles className="h-4 w-4" /> {t("audio.dailyReportPlaceholder")}
        </p>
      )}
    </SectionCard>
  );
}

function RecoverableRow({
  lead,
  getAmoLink,
}: {
  lead: RecoverableLeadView;
  getAmoLink: (id: number | null) => string | null;
}) {
  const { t, lang } = useI18n();
  const chat = useAiAssistantChat();
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const reply = await chat.mutateAsync({
        messages: [
          {
            role: "user",
            content: `This lead is marked Lost but had ${lead.connectedCalls} real connected call(s) with our team, last call ${lead.lastCallAt}. Lead: ${lead.name} (${lead.company || "no company"}), owner: ${lead.owner}, tags: ${lead.tags.join(", ") || "none"}. In 2-3 sentences, suggest why this lead might be worth a second outreach and a concrete next step. Respond in ${LANG_NAME[lang]}.`,
          },
        ],
      });
      setSuggestion(reply);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("audio.suggestFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {lead.company || lead.name}
          </p>
          <p className="truncate text-xs text-subtle">{lead.owner}</p>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone="warning">
            {t("audio.connectedCallsCount", { count: lead.connectedCalls })}
          </Pill>
        </div>
      </div>
      {lead.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {lead.tags.slice(0, 3).map((tag) => (
            <TagChip key={tag} tag={tag} size="xs" />
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-subtle">
        {t("audio.lastCall")}: {lead.lastCallAt}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link
          to="/crm/leads/$leadId"
          params={{ leadId: lead.id }}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent"
        >
          <ExternalLink className="h-3.5 w-3.5" /> {t("funnels.viewLead")}
        </Link>
        {getAmoLink(lead.amocrmId) && (
          <a
            href={getAmoLink(lead.amocrmId)!}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-foreground/90 px-2.5 text-xs font-bold text-background hover:opacity-80"
          >
            {t("leadFilter.openInAmoCrm")} <ExternalLink className="h-3 w-3" />
          </a>
        )}
        <button
          type="button"
          onClick={() => void generate()}
          disabled={busy}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/15 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {t("audio.suggestNextStep")}
        </button>
      </div>
      {suggestion && (
        <p className="mt-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs text-foreground">
          {suggestion}
        </p>
      )}
    </li>
  );
}

function CallRow({ call }: { call: AudioCallView }) {
  const { t } = useI18n();
  const analyze = useAnalyzeCall();
  const [expanded, setExpanded] = useState(false);

  async function onAnalyze() {
    try {
      const result = await analyze.mutateAsync(call.id);
      setExpanded(true);
      toast.success(t("audio.analyzed"));
      if (result.taskWarning) toast.error(result.taskWarning);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("audio.analyzeFailed"));
    }
  }

  return (
    <li className="px-6 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={
            call.direction === "in"
              ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
              : "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mint text-mint-foreground"
          }
        >
          {call.direction === "in" ? (
            <PhoneIncoming className="h-4 w-4" />
          ) : (
            <PhoneOutgoing className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {call.company || call.leadName || call.phone || "—"}
          </p>
          <p className="truncate text-xs text-subtle">
            {call.owner} · {call.occurredAt}
          </p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <Pill tone={call.connected ? "success" : "neutral"}>
            {call.connected ? t("audio.connected") : t("audio.notConnected")}
          </Pill>
          <span className="w-16 shrink-0 text-right text-xs font-medium text-muted-foreground">
            {formatDuration(call.durationSeconds, t("audio.min"))}
          </span>
          {call.recordingUrl && (
            <a
              href={call.recordingUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-muted-foreground hover:bg-accent"
            >
              <Phone className="h-3.5 w-3.5" /> {t("audio.listen")}
            </a>
          )}
          {call.recordingUrl &&
            (call.aiSummary ? (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {t("audio.viewAnalysis")}
                <ChevronDown
                  className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")}
                />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void onAnalyze()}
                disabled={analyze.isPending}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/15 disabled:opacity-60"
              >
                {analyze.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {t("audio.analyze")}
              </button>
            ))}
        </div>
      </div>

      {expanded && call.aiSummary && (
        <div className="mt-3 space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {t("audio.aiSummary")}
          </p>
          <p className="whitespace-pre-wrap text-sm text-foreground">{call.aiSummary}</p>
          {call.nextStep && (
            <div className="rounded-lg border border-mint/30 bg-mint/10 p-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-mint-foreground">
                {t("audio.nextStep")}
              </p>
              <p className="mt-1 text-sm text-foreground">{call.nextStep}</p>
              {call.amocrmTaskId && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-mint-foreground" />
                  {t("audio.taskCreated")}
                </p>
              )}
            </div>
          )}
          {call.transcript && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-medium text-subtle hover:text-foreground">
                {t("audio.viewTranscript")}
              </summary>
              <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                {call.transcript}
              </p>
            </details>
          )}
        </div>
      )}
    </li>
  );
}

function UploadCallDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useI18n();
  const { rows: leads } = useCrmLeads();
  const uploadCall = useUploadManualCall();
  const [file, setFile] = useState<File | null>(null);
  const [leadId, setLeadId] = useState("");
  const [phone, setPhone] = useState("");
  const [direction, setDirection] = useState<"in" | "out">("out");
  const [connected, setConnected] = useState(true);

  function reset() {
    setFile(null);
    setLeadId("");
    setPhone("");
    setDirection("out");
    setConnected(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    try {
      await uploadCall.mutateAsync({
        file,
        leadId: leadId || null,
        phone: phone.trim(),
        direction,
        connected,
      });
      toast.success(t("audio.uploadSuccess"));
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("audio.uploadFailed"));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("audio.uploadCall")}</DialogTitle>
          <DialogDescription>{t("audio.uploadCallDesc")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="text-[13px] font-medium text-muted-foreground">
              {t("audio.uploadCallFile")}
            </span>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
              className="mt-1.5 w-full rounded-xl border border-border bg-background p-2.5 text-sm outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary"
            />
          </label>

          <label className="block">
            <span className="text-[13px] font-medium text-muted-foreground">
              {t("audio.uploadCallLead")}
            </span>
            <select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-background p-2.5 text-sm outline-none focus:border-primary/40"
            >
              <option value="">{t("audio.uploadCallNoLead")}</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} {l.company ? `· ${l.company}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[13px] font-medium text-muted-foreground">
              {t("audio.uploadCallPhone")}
            </span>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-background p-2.5 text-sm outline-none focus:border-primary/40"
            />
          </label>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="radio"
                checked={direction === "out"}
                onChange={() => setDirection("out")}
              />
              {t("audio.directionOut")}
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="radio"
                checked={direction === "in"}
                onChange={() => setDirection("in")}
              />
              {t("audio.directionIn")}
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={connected}
                onChange={(e) => setConnected(e.target.checked)}
              />
              {t("audio.connected")}
            </label>
          </div>

          <DialogFooter>
            <button
              type="submit"
              disabled={uploadCall.isPending || !file}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {uploadCall.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("audio.uploadCallSubmit")}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AudioAnalytics() {
  const { t } = useI18n();
  const [asOfDate, setAsOfDate] = useState<Date | null>(null);
  const asOfSnapshot = useAsOfSnapshot<AmoCrmCallRow>("amocrm_calls", asOfDate);
  const {
    recent,
    totals,
    perRep,
    recoverable,
    isLoading: viewLoading,
  } = useAudioAnalyticsView(asOfDate ? (asOfSnapshot.data ?? []) : undefined);
  const isLoading = viewLoading || (asOfDate ? asOfSnapshot.isLoading : false);
  const getAmoLink = useAmoCrmLink();
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <>
      <PageHeader
        title={t("audio.title")}
        description={t("audio.desc")}
        actions={<AsOfDatePicker value={asOfDate} onChange={setAsOfDate} />}
      />

      <AsOfBanner value={asOfDate} />

      {isLoading && (
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("audio.callsToday")} value={String(totals.callsToday)} tone="mint" />
        <StatCard label={t("audio.connectionRate")} value={`${totals.connectionRate}%`} />
        <StatCard
          label={t("audio.avgDuration")}
          value={formatDuration(totals.avgDuration, t("audio.min"))}
        />
        <StatCard label={t("audio.totalCalls")} value={String(totals.total)} />
      </div>

      <div className="mt-8">
        <DailyReportCard
          callsToday={totals.callsToday}
          connectionRate={totals.connectionRate}
          avgDuration={totals.avgDuration}
          connected={totals.connected}
        />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SectionCard
            title={t("audio.recentCalls")}
            description={t("audio.recentCallsDesc")}
            actions={
              <button
                type="button"
                onClick={() => setUploadOpen(true)}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
              >
                <Upload className="h-3.5 w-3.5" />
                {t("audio.uploadCall")}
              </button>
            }
          >
            <UploadCallDialog open={uploadOpen} onOpenChange={setUploadOpen} />
            {recent.length === 0 ? (
              <p className="py-10 text-center text-sm text-subtle">{t("audio.noCalls")}</p>
            ) : (
              <ul className="-m-6 divide-y divide-border">
                {recent.slice(0, 20).map((c) => (
                  <CallRow key={c.id} call={c} />
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <SectionCard title={t("audio.perRep")} description={t("audio.perRepDesc")}>
          {perRep.length === 0 ? (
            <p className="text-sm text-subtle">{t("audio.noCalls")}</p>
          ) : (
            <ul className="space-y-3">
              {perRep.map((r) => (
                <li key={r.name} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium text-foreground">{r.name}</span>
                  <span className="shrink-0 text-xs text-subtle">
                    {r.calls} {t("audio.colCalls").toLowerCase()} ·{" "}
                    {r.calls ? Math.round((r.connected / r.calls) * 100) : 0}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="mt-8">
        <SectionCard title={t("audio.recoverable")} description={t("audio.recoverableDesc")}>
          {recoverable.length === 0 ? (
            <p className="py-6 text-center text-sm text-subtle">{t("audio.noRecoverable")}</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {recoverable.map((lead) => (
                <RecoverableRow key={lead.id} lead={lead} getAmoLink={getAmoLink} />
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}
