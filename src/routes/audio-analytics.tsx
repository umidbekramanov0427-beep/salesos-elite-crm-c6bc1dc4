import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  GitBranch,
  ListFilter,
  Loader2,
  MessageSquareQuote,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Smile,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Upload,
  User,
  X,
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
  useFunnelNames,
  useUploadManualCall,
  type AmoCrmCallRow,
  type AudioCallView,
  type RecoverableLeadView,
} from "@/hooks/use-crm-data";
import { AsOfDatePicker, AsOfBanner } from "@/components/filters/AsOfDatePicker";
import { DateRangeFilter, type DateFilterValue } from "@/components/leaderboard/DateRangeFilter";
import {
  AmountRangeFilter,
  EMPTY_AMOUNT_RANGE,
  amountInRange,
  type AmountRangeValue,
} from "@/components/filters/AmountRangeFilter";
import { FilterSelect, FilterSearchInput } from "@/components/filters/FilterSelect";
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

function scoreTone(score: number): "success" | "warning" | "danger" {
  if (score >= 80) return "success";
  if (score >= 50) return "warning";
  return "danger";
}

function formatDateCell(iso: string, lang: Lang): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString(lang === "uz" ? "en-CA" : lang),
    time: d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" }),
  };
}

type SortKey = "date" | "duration" | "score";

function SortableHeader({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-subtle",
        align === "right" && "text-right",
        align === "center" && "text-center",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-foreground",
          active && "text-primary",
          align === "right" && "flex-row-reverse",
        )}
      >
        {label}
        <ChevronDown
          className={cn("h-3 w-3 transition-transform", active && dir === "asc" && "rotate-180")}
        />
      </button>
    </th>
  );
}

function BulletList({
  icon: Icon,
  label,
  items,
  tone,
}: {
  icon: typeof ThumbsUp;
  label: string;
  items: string[];
  tone: "success" | "warning" | "danger" | "neutral";
}) {
  if (items.length === 0) return null;
  const toneClass = {
    success: "border-success/20 bg-success/5 text-success",
    warning: "border-warning/30 bg-warning/10 text-warning-foreground",
    danger: "border-destructive/20 bg-destructive/5 text-destructive",
    neutral: "border-border bg-surface text-foreground",
  }[tone];
  return (
    <div className={cn("rounded-lg border p-2.5", toneClass)}>
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <ul className="mt-1.5 space-y-1 text-sm text-foreground">
        {items.map((item, i) => (
          <li key={i} className="flex gap-1.5">
            <span className="text-subtle">·</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--color-border)",
  background: "var(--color-popover)",
  boxShadow: "var(--shadow-elevated)",
  fontSize: 12,
};

function AudioInsightsCharts({ calls }: { calls: AudioCallView[] }) {
  const { t } = useI18n();
  const analyzed = useMemo(() => calls.filter((c) => c.score != null), [calls]);

  const scoreTrend = useMemo(() => {
    const days: { label: string; score: number | null }[] = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayKey = d.toDateString();
      const dayCalls = analyzed.filter((c) => new Date(c.occurredAtRaw).toDateString() === dayKey);
      const avg = dayCalls.length
        ? Math.round(dayCalls.reduce((s, c) => s + (c.score ?? 0), 0) / dayCalls.length)
        : null;
      days.push({ label: `${d.getDate()}.${d.getMonth() + 1}`, score: avg });
    }
    return days;
  }, [analyzed]);

  const moodBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of analyzed) {
      if (!c.mood) continue;
      const key = c.mood.trim();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([mood, count]) => ({ mood, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [analyzed]);

  const skillsRadar = useMemo(() => {
    const bySkill = new Map<string, { met: number; total: number }>();
    for (const c of analyzed) {
      for (const item of c.analysis?.checklist ?? []) {
        if (!item.skill) continue;
        const cur = bySkill.get(item.skill) ?? { met: 0, total: 0 };
        cur.total += 1;
        if (item.met) cur.met += 1;
        bySkill.set(item.skill, cur);
      }
    }
    return Array.from(bySkill.entries()).map(([skill, { met, total }]) => ({
      skill,
      value: total > 0 ? Math.round((met / total) * 100) : 0,
    }));
  }, [analyzed]);

  const avgTalkRatio = useMemo(() => {
    const withRatio = analyzed.filter((c) => c.talkRatio != null);
    if (withRatio.length === 0) return null;
    return Math.round(withRatio.reduce((s, c) => s + (c.talkRatio ?? 0), 0) / withRatio.length);
  }, [analyzed]);

  if (analyzed.length === 0) return null;

  return (
    <div className="mt-8 grid gap-6 xl:grid-cols-2">
      <SectionCard
        title={t("audio.chart.scoreTrend")}
        description={t("audio.chart.scoreTrendDesc")}
      >
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={scoreTrend} margin={{ left: -14, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                fontSize={11}
                stroke="var(--color-subtle)"
              />
              <YAxis
                domain={[0, 100]}
                tickLine={false}
                axisLine={false}
                fontSize={11}
                stroke="var(--color-subtle)"
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="score"
                stroke="var(--color-primary)"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
                animationDuration={700}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard
        title={t("audio.chart.moodBreakdown")}
        description={t("audio.chart.moodBreakdownDesc")}
      >
        {moodBreakdown.length === 0 ? (
          <p className="py-10 text-center text-sm text-subtle">{t("audio.chart.noData")}</p>
        ) : (
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={moodBreakdown} margin={{ left: -14, right: 8, top: 8 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="mood"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  stroke="var(--color-subtle)"
                  interval={0}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  stroke="var(--color-subtle)"
                />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-accent)" }} />
                <Bar
                  dataKey="count"
                  fill="var(--color-primary)"
                  radius={[8, 8, 4, 4]}
                  animationDuration={700}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={t("audio.chart.skillsRadar")}
        description={t("audio.chart.skillsRadarDesc")}
      >
        {skillsRadar.length === 0 ? (
          <p className="py-10 text-center text-sm text-subtle">{t("audio.chart.noRubric")}</p>
        ) : (
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={skillsRadar}>
                <PolarGrid stroke="var(--color-border)" />
                <PolarAngleAxis dataKey="skill" fontSize={11} stroke="var(--color-subtle)" />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  dataKey="value"
                  stroke="var(--color-primary)"
                  fill="var(--color-primary)"
                  fillOpacity={0.25}
                  animationDuration={700}
                />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      <SectionCard title={t("audio.chart.talkRatio")} description={t("audio.chart.talkRatioDesc")}>
        {avgTalkRatio == null ? (
          <p className="py-10 text-center text-sm text-subtle">{t("audio.chart.noData")}</p>
        ) : (
          <div className="space-y-3 py-4">
            <div className="flex h-8 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="flex items-center justify-center bg-primary text-xs font-semibold text-primary-foreground transition-[width]"
                style={{ width: `${avgTalkRatio}%` }}
              >
                {avgTalkRatio}%
              </div>
              <div className="flex flex-1 items-center justify-center bg-mint text-xs font-semibold text-mint-foreground">
                {100 - avgTalkRatio}%
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" /> {t("audio.chart.rep")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-mint-border" /> {t("audio.chart.customer")}
              </span>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
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
          search={{ from: "audio" }}
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

const CALL_TABLE_COLSPAN = 11;

function CallTableRow({ call, lang }: { call: AudioCallView; lang: Lang }) {
  const { t } = useI18n();
  const analyze = useAnalyzeCall();
  const [expanded, setExpanded] = useState(false);
  const { date, time } = formatDateCell(call.occurredAtRaw, lang);

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
    <>
      <tr className="border-b border-border last:border-0 hover:bg-accent/40">
        <td className="whitespace-nowrap px-4 py-3">
          <p className="text-sm font-medium text-foreground">{date}</p>
          <p className="text-xs text-subtle">{time}</p>
        </td>
        <td className="max-w-[160px] truncate px-4 py-3 text-sm text-foreground">
          {call.owner || "—"}
        </td>
        <td className="max-w-[200px] px-4 py-3">
          <p className="truncate text-sm font-medium text-foreground">
            {call.leadName || call.company || call.phone || "—"}
          </p>
          {call.phone && <p className="truncate text-xs text-subtle">{call.phone}</p>}
        </td>
        <td className="px-4 py-3 text-center">
          {call.direction === "in" ? (
            <PhoneIncoming className="mx-auto h-4 w-4 text-primary" />
          ) : (
            <PhoneOutgoing className="mx-auto h-4 w-4 text-mint-foreground" />
          )}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-muted-foreground">
          {formatDuration(call.durationSeconds, t("audio.min"))}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right">
          {call.score != null ? (
            <Pill tone={scoreTone(call.score)}>{call.score}</Pill>
          ) : (
            <span className="text-xs text-subtle">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-center">
          {call.connected ? (
            <CheckCircle2 className="mx-auto h-4 w-4 text-success" />
          ) : (
            <X className="mx-auto h-4 w-4 text-subtle" />
          )}
        </td>
        <td className="whitespace-nowrap px-4 py-3">
          <Pill tone={call.connected ? "success" : "neutral"}>
            {call.connected ? t("audio.connected") : t("audio.notConnected")}
          </Pill>
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
          {call.mood || "—"}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
          {call.stage || "—"}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1.5">
            {call.recordingUrl && (
              <a
                href={call.recordingUrl}
                target="_blank"
                rel="noreferrer"
                title={t("audio.listen")}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent"
              >
                <Phone className="h-3.5 w-3.5" />
              </a>
            )}
            {call.recordingUrl &&
              (call.aiSummary ? (
                <button
                  type="button"
                  onClick={() => setExpanded((e) => !e)}
                  title={t("audio.viewAnalysis")}
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <ChevronDown
                    className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")}
                  />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void onAnalyze()}
                  disabled={analyze.isPending}
                  title={t("audio.analyze")}
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/15 disabled:opacity-60"
                >
                  {analyze.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                </button>
              ))}
          </div>
        </td>
      </tr>

      {expanded && call.aiSummary && (
        <tr className="border-b border-border last:border-0">
          <td colSpan={CALL_TABLE_COLSPAN} className="bg-primary/5 px-4 py-4">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {t("audio.aiSummary")}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{call.aiSummary}</p>
              </div>

              {(call.mood || call.talkRatio != null) && (
                <div className="flex flex-wrap gap-2">
                  {call.mood && (
                    <span className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground">
                      {t("audio.mood")}: {call.mood}
                    </span>
                  )}
                  {call.talkRatio != null && (
                    <span className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground">
                      {t("audio.talkRatio")}: {call.talkRatio}%
                    </span>
                  )}
                </div>
              )}

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

              {call.analysis && call.analysis.checklist.length > 0 && (
                <div className="rounded-lg border border-border bg-surface p-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
                    {t("audio.checklist")}
                  </p>
                  <ul className="mt-1.5 space-y-1.5">
                    {call.analysis.checklist.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2
                          className={cn(
                            "mt-0.5 h-4 w-4 shrink-0",
                            item.met ? "text-success" : "text-subtle",
                          )}
                        />
                        <span className={cn("flex-1", !item.met && "text-muted-foreground")}>
                          {item.step}
                          {item.note && (
                            <span className="block text-xs text-subtle">{item.note}</span>
                          )}
                        </span>
                        <span className="shrink-0 text-xs text-subtle">
                          {item.points} {t("audio.pts")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {call.analysis && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <BulletList
                    icon={ThumbsUp}
                    label={t("audio.strengths")}
                    items={call.analysis.strengths}
                    tone="success"
                  />
                  <BulletList
                    icon={ThumbsDown}
                    label={t("audio.improvements")}
                    items={call.analysis.improvements}
                    tone="warning"
                  />
                  <BulletList
                    icon={AlertTriangle}
                    label={t("audio.warnings")}
                    items={call.analysis.warnings}
                    tone="danger"
                  />
                  <BulletList
                    icon={ShieldAlert}
                    label={t("audio.risks")}
                    items={call.analysis.risks}
                    tone="danger"
                  />
                  <BulletList
                    icon={CheckCircle2}
                    label={t("audio.agreements")}
                    items={call.analysis.agreements}
                    tone="neutral"
                  />
                  <BulletList
                    icon={MessageSquareQuote}
                    label={t("audio.topObjections")}
                    items={call.analysis.topObjections}
                    tone="neutral"
                  />
                </div>
              )}

              {call.analysis && call.analysis.keyQuotes.length > 0 && (
                <div className="rounded-lg border border-border bg-surface p-2.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-subtle">
                    <MessageSquareQuote className="h-3.5 w-3.5" /> {t("audio.keyQuotes")}
                  </p>
                  <ul className="mt-1.5 space-y-1.5">
                    {call.analysis.keyQuotes.map((q, i) => (
                      <li
                        key={i}
                        className="border-l-2 border-primary/30 pl-2 text-sm italic text-foreground"
                      >
                        "{q}"
                      </li>
                    ))}
                  </ul>
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
          </td>
        </tr>
      )}
    </>
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
  const { t, lang } = useI18n();
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

  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState<"" | "in" | "out">("");
  const [connectedFilter, setConnectedFilter] = useState<"" | "yes" | "no">("");
  const [ownerId, setOwnerId] = useState("");
  const [funnelFilter, setFunnelFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [moodFilter, setMoodFilter] = useState("");
  const [scoreRange, setScoreRange] = useState<AmountRangeValue>(EMPTY_AMOUNT_RANGE);
  const [durationRange, setDurationRange] = useState<AmountRangeValue>(EMPTY_AMOUNT_RANGE);
  const [dateFilter, setDateFilter] = useState<DateFilterValue>({
    from: null,
    to: null,
    label: t("lb.presetAll"),
  });
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const { names: funnelNames } = useFunnelNames();

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const owners = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of recent) if (c.ownerId && c.owner) map.set(c.ownerId, c.owner);
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [recent]);
  const stages = useMemo(
    () => Array.from(new Set(recent.map((c) => c.stage).filter((s): s is string => !!s))).sort(),
    [recent],
  );
  const moods = useMemo(
    () => Array.from(new Set(recent.map((c) => c.mood).filter((m): m is string => !!m))).sort(),
    [recent],
  );

  const hasActiveFilters =
    !!search ||
    !!direction ||
    !!connectedFilter ||
    !!ownerId ||
    !!funnelFilter ||
    !!stageFilter ||
    !!moodFilter ||
    scoreRange.min != null ||
    scoreRange.max != null ||
    durationRange.min != null ||
    durationRange.max != null ||
    !!dateFilter.from ||
    !!dateFilter.to;

  function clearFilters() {
    setSearch("");
    setDirection("");
    setConnectedFilter("");
    setOwnerId("");
    setFunnelFilter("");
    setStageFilter("");
    setMoodFilter("");
    setScoreRange(EMPTY_AMOUNT_RANGE);
    setDurationRange(EMPTY_AMOUNT_RANGE);
    setDateFilter({ from: null, to: null, label: t("lb.presetAll") });
  }

  const filteredCalls = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recent.filter((c) => {
      if (direction && c.direction !== direction) return false;
      if (connectedFilter === "yes" && !c.connected) return false;
      if (connectedFilter === "no" && c.connected) return false;
      if (ownerId && c.ownerId !== ownerId) return false;
      if (funnelFilter && c.funnel !== funnelFilter) return false;
      if (stageFilter && c.stage !== stageFilter) return false;
      if (moodFilter && c.mood !== moodFilter) return false;
      if ((scoreRange.min != null || scoreRange.max != null) && c.score == null) return false;
      if (c.score != null && !amountInRange(c.score, scoreRange)) return false;
      if (!amountInRange(c.durationSeconds, durationRange)) return false;
      if (dateFilter.from && new Date(c.occurredAtRaw) < dateFilter.from) return false;
      if (dateFilter.to && new Date(c.occurredAtRaw) > dateFilter.to) return false;
      if (q) {
        const haystack = [c.leadName, c.company, c.owner, c.phone, c.transcript ?? ""]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [
    recent,
    search,
    direction,
    connectedFilter,
    ownerId,
    funnelFilter,
    stageFilter,
    moodFilter,
    scoreRange,
    durationRange,
    dateFilter,
  ]);

  const sortedCalls = useMemo(() => {
    const arr = [...filteredCalls];
    arr.sort((a, b) => {
      let diff = 0;
      if (sortKey === "date") {
        diff = new Date(a.occurredAtRaw).getTime() - new Date(b.occurredAtRaw).getTime();
      } else if (sortKey === "duration") {
        diff = a.durationSeconds - b.durationSeconds;
      } else if (sortKey === "score") {
        diff = (a.score ?? -1) - (b.score ?? -1);
      }
      return sortDir === "asc" ? diff : -diff;
    });
    return arr;
  }, [filteredCalls, sortKey, sortDir]);

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

      <div className="mt-8">
        <AudioInsightsCharts calls={recent} />
      </div>

      <div className="mt-8">
        <SectionCard title={t("audio.filters")}>
          <div className="flex flex-wrap items-center gap-3">
            <FilterSearchInput
              icon={Search}
              value={search}
              onChange={setSearch}
              placeholder={t("audio.searchPlaceholder")}
              className="w-64"
            />
            <FilterSelect
              icon={PhoneCall}
              value={connectedFilter}
              onChange={(v) => setConnectedFilter(v as "" | "yes" | "no")}
            >
              <option value="">{t("audio.filterAllResults")}</option>
              <option value="yes">{t("audio.connected")}</option>
              <option value="no">{t("audio.notConnected")}</option>
            </FilterSelect>
            <FilterSelect
              icon={ArrowLeftRight}
              value={direction}
              onChange={(v) => setDirection(v as "" | "in" | "out")}
            >
              <option value="">{t("audio.filterAllDirections")}</option>
              <option value="in">{t("audio.filterIncoming")}</option>
              <option value="out">{t("audio.filterOutgoing")}</option>
            </FilterSelect>
            <FilterSelect icon={User} value={ownerId} onChange={setOwnerId}>
              <option value="">{t("audio.filterAllOwners")}</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </FilterSelect>
            <DateRangeFilter value={dateFilter} onChange={setDateFilter} />
            <button
              type="button"
              onClick={() => setShowMoreFilters((v) => !v)}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-2xl border pl-3.5 pr-3 text-sm font-medium transition-colors",
                showMoreFilters
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-accent",
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {t("audio.moreFilters")}
            </button>
          </div>

          {hasActiveFilters && (
            <div className="mt-3">
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-2xl border border-border bg-background pl-3.5 pr-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
              >
                <X className="h-4 w-4" />
                {t("audio.clearFilters")}
              </button>
            </div>
          )}

          {showMoreFilters && (
            <div className="mt-3 grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-subtle">
                  {t("leadFilter.allFunnels")}
                </p>
                <FilterSelect
                  icon={GitBranch}
                  value={funnelFilter}
                  onChange={setFunnelFilter}
                  className="w-full"
                >
                  <option value="">{t("leadFilter.allFunnels")}</option>
                  {funnelNames.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </FilterSelect>
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-subtle">
                  {t("audio.filterAllStages")}
                </p>
                <FilterSelect
                  icon={ListFilter}
                  value={stageFilter}
                  onChange={setStageFilter}
                  className="w-full"
                >
                  <option value="">{t("audio.filterAllStages")}</option>
                  {stages.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </FilterSelect>
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-subtle">
                  {t("audio.filterAllMoods")}
                </p>
                <FilterSelect
                  icon={Smile}
                  value={moodFilter}
                  onChange={setMoodFilter}
                  className="w-full"
                >
                  <option value="">{t("audio.filterAllMoods")}</option>
                  {moods.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </FilterSelect>
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-subtle">
                  {t("audio.scoreRange")}
                </p>
                <AmountRangeFilter value={scoreRange} onChange={setScoreRange} />
              </div>
              <div className="sm:col-span-2">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-subtle">
                  {t("audio.durationRangeSec")}
                </p>
                <AmountRangeFilter value={durationRange} onChange={setDurationRange} />
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-8">
        <SectionCard
          title={t("audio.recentCalls")}
          description={t("audio.callsShownCount", {
            shown: Math.min(visibleCount, sortedCalls.length),
            total: sortedCalls.length,
          })}
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
          {sortedCalls.length === 0 ? (
            <div className="py-10 text-center text-sm text-subtle">
              <p>{hasActiveFilters ? t("audio.noFilteredCalls") : t("audio.noCalls")}</p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-2xl border border-border bg-background px-3.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
                >
                  <X className="h-4 w-4" />
                  {t("audio.clearFilters")}
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="-mx-6 -mb-6 overflow-x-auto">
                <table className="w-full min-w-[1080px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <SortableHeader
                        label={t("audio.colDate")}
                        active={sortKey === "date"}
                        dir={sortDir}
                        onClick={() => toggleSort("date")}
                      />
                      <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-subtle">
                        {t("audio.colOperator")}
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-subtle">
                        {t("audio.colLead")}
                      </th>
                      <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-subtle">
                        {t("audio.colDirection")}
                      </th>
                      <SortableHeader
                        label={t("audio.colDuration")}
                        active={sortKey === "duration"}
                        dir={sortDir}
                        onClick={() => toggleSort("duration")}
                        align="right"
                      />
                      <SortableHeader
                        label={t("audio.colScore")}
                        active={sortKey === "score"}
                        dir={sortDir}
                        onClick={() => toggleSort("score")}
                        align="right"
                      />
                      <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-subtle">
                        {t("audio.colStatus")}
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-subtle">
                        {t("audio.colResult")}
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-subtle">
                        {t("audio.colMood")}
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-subtle">
                        {t("audio.colStage")}
                      </th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-subtle">
                        {t("audio.colActions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCalls.slice(0, visibleCount).map((c) => (
                      <CallTableRow key={c.id} call={c} lang={lang} />
                    ))}
                  </tbody>
                </table>
              </div>
              {visibleCount < sortedCalls.length && (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((v) => v + 20)}
                    className="inline-flex h-9 items-center rounded-xl border border-border bg-background px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
                  >
                    {t("audio.loadMore")}
                  </button>
                </div>
              )}
            </>
          )}
        </SectionCard>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
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

        <SectionCard title={t("audio.recoverable")} description={t("audio.recoverableDesc")}>
          {recoverable.length === 0 ? (
            <p className="py-6 text-center text-sm text-subtle">{t("audio.noRecoverable")}</p>
          ) : (
            <ul className="grid gap-3">
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
