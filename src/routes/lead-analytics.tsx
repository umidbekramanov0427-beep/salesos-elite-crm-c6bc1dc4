import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type CSSProperties } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Loader2,
  Zap,
  Layers,
  SlidersHorizontal,
  Shuffle,
  GitBranch,
  User,
  Users,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { FilterTile, TileOption } from "@/components/filters/FilterTile";
import { PageHeader, SectionCard, StatCard, Pill } from "@/components/layout/Primitives";
import {
  useFunnelNames,
  useProfilesRaw,
  useLeadAnalyticsAction,
  useManagerIdsInFunnel,
  useLeadAnalyticsQuality,
  useLeadAnalyticsCurrent,
  useLeadAnalyticsDirection,
  type LeadAnalyticsRecoverableRow,
  type LeadAnalyticsHotRow,
  type LeadAnalyticsTagResultRow,
  type LeadAnalyticsTagMatrixRow,
  type LeadAnalyticsTagCategoryRow,
  type LeadAnalyticsStageRow,
  type LeadAnalyticsManagerLoadRow,
  type LeadAnalyticsLostReasonRow,
  type LeadAnalyticsChurnRow,
} from "@/hooks/use-crm-data";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { PermissionGate } from "@/components/PermissionGate";

export const Route = createFileRoute("/lead-analytics")({
  head: () => ({
    meta: [
      { title: "Lead Analytics — SalesOS Elite" },
      {
        name: "description",
        content: "At-risk leads, hot leads close to closing, and lead conversion health.",
      },
    ],
  }),
  component: LeadAnalyticsGated,
});

function LeadAnalyticsGated() {
  return (
    <PermissionGate action="View leads">
      <LeadAnalytics />
    </PermissionGate>
  );
}

type Tab = "action" | "quality" | "current" | "direction";
type Period = "daily" | "weekly" | "monthly" | "all";

function periodSince(period: Period, monthYear: number, monthIndex: number): Date | null {
  const now = new Date();
  if (period === "daily") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === "weekly") {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === "monthly") {
    return new Date(monthYear, monthIndex, 1);
  }
  return null;
}

const MONTH_TILE_LABELS = [
  "Yan",
  "Fev",
  "Mar",
  "Apr",
  "May",
  "Iyun",
  "Iyul",
  "Avg",
  "Sen",
  "Okt",
  "Noy",
  "Dek",
];

function TempPill({ temperature, t }: { temperature: string; t: (k: string) => string }) {
  const tone =
    temperature === "VeryHot"
      ? "danger"
      : temperature === "Hot"
        ? "danger"
        : temperature === "Warm"
          ? "gold"
          : "blue";
  const label =
    temperature === "VeryHot"
      ? t("leadAnalytics.tempVeryHot")
      : temperature === "Hot"
        ? t("leadAnalytics.tempHot")
        : temperature === "Warm"
          ? t("leadAnalytics.tempWarm")
          : t("leadAnalytics.tempCold");
  return <Pill tone={tone}>{label}</Pill>;
}

function RecoverableTable({
  rows,
  t,
}: {
  rows: LeadAnalyticsRecoverableRow[];
  t: (k: string, vars?: Record<string, string | number>) => string;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">{t("leadAnalytics.noLost")}</p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-subtle">
            <th className="py-2 pr-3">{t("leadAnalytics.colLead")}</th>
            <th className="py-2 pr-3">{t("leadAnalytics.colManager")}</th>
            <th className="py-2 pr-3 text-right">{t("leadAnalytics.colDaysClosed")}</th>
            <th className="py-2 pl-3">{t("leadAnalytics.colNextFollowUp")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.lead_id} className="border-b border-border/60 last:border-0">
              <td className="max-w-[160px] truncate py-2 pr-3 font-semibold text-foreground">
                {r.name}
              </td>
              <td className="max-w-[140px] truncate py-2 pr-3 text-muted-foreground">
                {r.manager}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-foreground">
                {r.days_since_closed}d
              </td>
              <td className="max-w-[220px] truncate py-2 pl-3 text-xs text-subtle">
                {r.next_follow_up || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HotPipelineTable({
  rows,
  format,
  t,
}: {
  rows: LeadAnalyticsHotRow[];
  format: (n: number) => string;
  t: (k: string) => string;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">{t("leadAnalytics.noHot")}</p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-subtle">
            <th className="py-2 pr-3">{t("leadAnalytics.colLead")}</th>
            <th className="py-2 pr-3">{t("leadAnalytics.colManager")}</th>
            <th className="py-2 pr-3 text-right">{t("leadAnalytics.colScore")}</th>
            <th className="py-2 pr-3">{t("leadAnalytics.colTemperature")}</th>
            <th className="py-2 pr-3">{t("leadAnalytics.colStage")}</th>
            <th className="py-2 pl-3 text-right">{t("leadAnalytics.colValue")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.lead_id} className="border-b border-border/60 last:border-0">
              <td className="max-w-[140px] truncate py-2 pr-3 font-semibold text-foreground">
                {r.name}
              </td>
              <td className="max-w-[120px] truncate py-2 pr-3 text-muted-foreground">
                {r.manager}
              </td>
              <td className="py-2 pr-3 text-right font-bold tabular-nums text-foreground">
                {r.score}
              </td>
              <td className="py-2 pr-3">
                <TempPill temperature={r.temperature} t={t} />
              </td>
              <td className="max-w-[120px] truncate py-2 pr-3 text-muted-foreground">{r.stage}</td>
              <td className="py-2 pl-3 text-right font-semibold tabular-nums text-foreground">
                {format(r.value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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

function ActionTab({
  data,
  isLoading,
  format,
  t,
}: {
  data: ReturnType<typeof useLeadAnalyticsAction>["data"];
  isLoading: boolean;
  format: (n: number) => string;
  t: (k: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <>
      <div className="mt-8">
        <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
          01 &nbsp;{t("leadAnalytics.actionSectionLabel")}
        </p>
        <h2 className="mt-1 text-xl font-bold text-foreground">{t("leadAnalytics.actionTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("leadAnalytics.actionDesc")}</p>
      </div>

      <div className="mt-4 grid gap-6 xl:grid-cols-2">
        <SectionCard title={t("leadAnalytics.lostTitle")} description={t("leadAnalytics.lostDesc")}>
          {isLoading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-subtle" />
          ) : (
            <RecoverableTable rows={data?.recoverable ?? []} t={t} />
          )}
        </SectionCard>

        <SectionCard title={t("leadAnalytics.hotTitle")} description={t("leadAnalytics.hotDesc")}>
          {isLoading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-subtle" />
          ) : (
            <HotPipelineTable rows={data?.hotPipeline ?? []} format={format} t={t} />
          )}
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard
          title={t("leadAnalytics.operatorActivityTitle")}
          description={t("leadAnalytics.operatorActivityDesc")}
        >
          {isLoading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-subtle" />
          ) : (data?.operatorActivity ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("leadAnalytics.noOperatorActivity")}
            </p>
          ) : (
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data?.operatorActivity ?? []}
                  margin={{ left: -14, right: 8, top: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="manager"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    stroke="var(--color-subtle)"
                    interval={0}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    stroke="var(--color-subtle)"
                  />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-accent)" }} />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(value: string) =>
                      value === "won_connected"
                        ? t("leadAnalytics.legendWonConnected")
                        : value === "won_attempts"
                          ? t("leadAnalytics.legendWonAttempts")
                          : value === "lost_connected"
                            ? t("leadAnalytics.legendLostConnected")
                            : t("leadAnalytics.legendLostAttempts")
                    }
                  />
                  <Bar dataKey="won_connected" stackId="a" fill="var(--color-success)" />
                  <Bar dataKey="won_attempts" stackId="a" fill="var(--color-mint-border)" />
                  <Bar dataKey="lost_connected" stackId="a" fill="var(--color-warning)" />
                  <Bar dataKey="lost_attempts" stackId="a" fill="var(--color-destructive)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}

function TagResultsBars({
  rows,
  t,
}: {
  rows: LeadAnalyticsTagResultRow[];
  t: (k: string) => string;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("leadAnalytics.noTagData")}
      </p>
    );
  }
  const max = Math.max(...rows.map((r) => r.total), 1);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-success" /> {t("leadAnalytics.legendSold")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive" />{" "}
          {t("leadAnalytics.legendLost")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />{" "}
          {t("leadAnalytics.legendOpen")}
        </span>
      </div>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.tag} className="flex items-center gap-3">
            <span
              className="w-32 shrink-0 truncate text-xs font-medium text-foreground"
              title={r.tag}
            >
              {r.tag}
            </span>
            <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-success" style={{ width: `${(r.sold / max) * 100}%` }} />
              <div
                className="h-full bg-destructive"
                style={{ width: `${(r.lost / max) * 100}%` }}
              />
              <div
                className="h-full bg-muted-foreground/40"
                style={{ width: `${(r.open / max) * 100}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-subtle">
              {r.total}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Green (good) -> red (bad) blend, normalized against this tag set's own
// min/max for the column -- an absolute 0-100 scale would leave every real
// account's spread looking uniformly beige, since scores/conversion rarely
// span the full range in practice.
function heatStyle(value: number | null, min: number, max: number): CSSProperties {
  if (value == null || max === min) return {};
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const r = Math.round(239 - (239 - 34) * t);
  const g = Math.round(68 + (197 - 68) * t);
  const b = Math.round(68 + (94 - 68) * t);
  return { backgroundColor: `rgba(${r}, ${g}, ${b}, 0.16)` };
}

function TagMatrixTable({
  rows,
  t,
}: {
  rows: LeadAnalyticsTagMatrixRow[];
  t: (k: string) => string;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("leadAnalytics.noTagData")}
      </p>
    );
  }
  const scores = rows.map((r) => r.avg_score).filter((v): v is number => v != null);
  const convs = rows.map((r) => r.conversion).filter((v): v is number => v != null);
  const scoreMin = Math.min(...scores, 0);
  const scoreMax = Math.max(...scores, 1);
  const convMin = Math.min(...convs, 0);
  const convMax = Math.max(...convs, 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-subtle">
            <th className="py-2 pr-3">{t("leadAnalytics.colTag")}</th>
            <th className="py-2 pr-3 text-right">{t("leadAnalytics.colLeads")}</th>
            <th className="py-2 pr-3 text-right">{t("leadAnalytics.colScore")}</th>
            <th className="py-2 pr-3 text-right">{t("leadAnalytics.colConv")}</th>
            <th className="py-2 pl-3 text-right">{t("leadAnalytics.colQualification")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.tag}
              className={cn(
                "border-b border-border/60 last:border-0",
                r.low_sample && "opacity-40",
              )}
            >
              <td className="max-w-[160px] truncate py-2 pr-3 font-semibold text-foreground">
                {r.tag}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-foreground">{r.total}</td>
              <td
                className="py-2 pr-3 text-right tabular-nums text-foreground"
                style={heatStyle(r.avg_score, scoreMin, scoreMax)}
              >
                {r.avg_score ?? "—"} <span className="text-subtle">/{r.total}</span>
              </td>
              <td
                className="py-2 pr-3 text-right tabular-nums text-foreground"
                style={heatStyle(r.conversion, convMin, convMax)}
              >
                {r.conversion != null ? `${r.conversion}%` : "—"}
              </td>
              <td className="py-2 pl-3 text-right tabular-nums text-subtle">
                {t("leadAnalytics.noQualificationData")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs leading-relaxed text-subtle">
        {t("leadAnalytics.matrixFootnote")}
      </p>
    </div>
  );
}

function TagCategoryChart({ rows }: { rows: LeadAnalyticsTagCategoryRow[] }) {
  const data = rows.map((r) => ({
    tag: r.tag,
    Sovuq: r.cold,
    Iliq: r.warm,
    Issiq: r.hot,
    "Juda issiq": r.very_hot,
  }));
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -14, right: 8, top: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="tag"
            tickLine={false}
            axisLine={false}
            fontSize={10}
            stroke="var(--color-subtle)"
            interval={0}
            angle={-20}
            textAnchor="end"
            height={50}
          />
          <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-subtle)" />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-accent)" }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="Sovuq" stackId="a" fill="var(--color-primary)" />
          <Bar dataKey="Iliq" stackId="a" fill="var(--color-mint-border)" />
          <Bar dataKey="Issiq" stackId="a" fill="var(--color-warning)" />
          <Bar dataKey="Juda issiq" stackId="a" fill="var(--color-destructive)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function QualityTab({
  funnel,
  managerId,
  teamId,
  since,
  t,
}: {
  funnel: string;
  managerId: string;
  teamId: string;
  since: Date | null;
  t: (k: string, vars?: Record<string, string | number>) => string;
}) {
  const { data, isLoading } = useLeadAnalyticsQuality(
    funnel || null,
    managerId || null,
    teamId || null,
    since,
  );
  return (
    <>
      <div className="mt-8">
        <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
          02 &nbsp;{t("leadAnalytics.tagResultsLabel")}
        </p>
        <h2 className="mt-1 text-xl font-bold text-foreground">
          {t("leadAnalytics.qualityTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("leadAnalytics.qualityDesc")}</p>
      </div>

      <div className="mt-4 grid gap-6 xl:grid-cols-2">
        <SectionCard
          title={t("leadAnalytics.tagResultsTitle")}
          description={t("leadAnalytics.tagResultsDesc")}
        >
          {isLoading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-subtle" />
          ) : (
            <TagResultsBars rows={data?.tagResults ?? []} t={t} />
          )}
        </SectionCard>

        <SectionCard
          title={t("leadAnalytics.matrixTitle")}
          description={t("leadAnalytics.matrixDesc")}
        >
          {isLoading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-subtle" />
          ) : (
            <TagMatrixTable rows={data?.tagMatrix ?? []} t={t} />
          )}
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard
          title={t("leadAnalytics.categoryTitle")}
          description={t("leadAnalytics.categoryDesc")}
        >
          {isLoading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-subtle" />
          ) : (data?.tagCategories ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("leadAnalytics.noTagData")}
            </p>
          ) : (
            <TagCategoryChart rows={data?.tagCategories ?? []} />
          )}
        </SectionCard>
      </div>
    </>
  );
}

function TemperatureDonut({
  temperature,
  t,
}: {
  temperature: { cold: number; warm: number; hot: number; veryHot: number };
  t: (k: string) => string;
}) {
  const data = [
    { name: t("leadAnalytics.tempCold"), value: temperature.cold, color: "var(--color-primary)" },
    {
      name: t("leadAnalytics.tempWarm"),
      value: temperature.warm,
      color: "var(--color-mint-border)",
    },
    { name: t("leadAnalytics.tempHot"), value: temperature.hot, color: "var(--color-warning)" },
    {
      name: t("leadAnalytics.tempVeryHot"),
      value: temperature.veryHot,
      color: "var(--color-destructive)",
    },
  ];
  const total = temperature.cold + temperature.warm + temperature.hot + temperature.veryHot;
  return (
    <div className="relative h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={70} outerRadius={100} paddingAngle={2}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-extrabold text-foreground">{total}</span>
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
        {data.map((d) => (
          <span key={d.name} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
            {d.name} {d.value}
          </span>
        ))}
      </div>
    </div>
  );
}

function StageFunnelList({ rows, t }: { rows: LeadAnalyticsStageRow[]; t: (k: string) => string }) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("leadAnalytics.noStages")}
      </p>
    );
  }
  const max = Math.max(...rows.map((r) => r.lead_count), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.stage} className="flex items-center gap-3">
          <span
            className="w-36 shrink-0 truncate text-xs font-medium text-foreground"
            title={r.stage}
          >
            {r.stage}
          </span>
          <div className="h-6 flex-1 overflow-hidden rounded-lg bg-muted">
            <div
              className="flex h-full items-center rounded-lg bg-primary/70 px-2"
              style={{ width: `${Math.max((r.lead_count / max) * 100, 8)}%` }}
            >
              <span className="text-[11px] font-bold text-primary-foreground">{r.lead_count}</span>
            </div>
          </div>
          <span className="w-14 shrink-0 text-right text-xs tabular-nums text-subtle">
            {r.avg_days != null ? `${r.avg_days}${t("leadAnalytics.daysSuffix")}` : "—"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ManagerLoadChart({ rows }: { rows: LeadAnalyticsManagerLoadRow[] }) {
  const data = rows.map((r) => ({
    manager: r.manager,
    Sovuq: r.cold,
    Iliq: r.warm,
    Issiq: r.hot,
    "Juda issiq": r.very_hot,
  }));
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -14, right: 8, top: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="manager"
            tickLine={false}
            axisLine={false}
            fontSize={10}
            stroke="var(--color-subtle)"
            interval={0}
            angle={-30}
            textAnchor="end"
            height={60}
          />
          <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-subtle)" />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-accent)" }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="Sovuq" stackId="a" fill="var(--color-primary)" />
          <Bar dataKey="Iliq" stackId="a" fill="var(--color-mint-border)" />
          <Bar dataKey="Issiq" stackId="a" fill="var(--color-warning)" />
          <Bar dataKey="Juda issiq" stackId="a" fill="var(--color-destructive)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CurrentTab({
  funnel,
  managerId,
  teamId,
  since,
  t,
}: {
  funnel: string;
  managerId: string;
  teamId: string;
  since: Date | null;
  t: (k: string, vars?: Record<string, string | number>) => string;
}) {
  const { data, isLoading } = useLeadAnalyticsCurrent(
    funnel || null,
    managerId || null,
    teamId || null,
    since,
  );
  return (
    <>
      <div className="mt-8">
        <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
          03 &nbsp;{t("leadAnalytics.stagesLabel")}
        </p>
        <h2 className="mt-1 text-xl font-bold text-foreground">
          {t("leadAnalytics.currentTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("leadAnalytics.currentDesc")}</p>
      </div>

      <div className="mt-4 grid gap-6 xl:grid-cols-2">
        <SectionCard
          title={t("leadAnalytics.temperatureTitle")}
          description={t("leadAnalytics.temperatureDesc")}
        >
          {isLoading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-subtle" />
          ) : (
            <TemperatureDonut
              temperature={data?.temperature ?? { cold: 0, warm: 0, hot: 0, veryHot: 0 }}
              t={t}
            />
          )}
        </SectionCard>

        <SectionCard
          title={t("leadAnalytics.stagesTitle")}
          description={t("leadAnalytics.stagesDesc")}
        >
          {isLoading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-subtle" />
          ) : (
            <StageFunnelList rows={data?.stages ?? []} t={t} />
          )}
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard
          title={t("leadAnalytics.managerLoadTitle")}
          description={t("leadAnalytics.managerLoadDesc")}
        >
          {isLoading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-subtle" />
          ) : (data?.managerLoad ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("leadAnalytics.noManagerLoad")}
            </p>
          ) : (
            <ManagerLoadChart rows={data?.managerLoad ?? []} />
          )}
        </SectionCard>
      </div>
    </>
  );
}

function TrajectoryDonut({
  direction,
  t,
}: {
  direction: { closingSoon: number; neutral: number; losingSoon: number };
  t: (k: string) => string;
}) {
  const data = [
    {
      name: t("leadAnalytics.closingSoon"),
      value: direction.closingSoon,
      color: "var(--color-success)",
    },
    { name: t("leadAnalytics.neutral"), value: direction.neutral, color: "var(--color-primary)" },
    {
      name: t("leadAnalytics.losingSoon"),
      value: direction.losingSoon,
      color: "var(--color-destructive)",
    },
  ];
  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={70} outerRadius={100} paddingAngle={2}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value: string) => {
              const d = data.find((x) => x.name === value);
              return `${value} ${d?.value ?? 0}`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

const LOST_REASON_COLORS = [
  "var(--color-destructive)",
  "var(--color-warning)",
  "var(--color-primary)",
  "var(--color-mint-border)",
  "var(--color-success)",
];

function LostReasonsDonut({
  rows,
  t,
}: {
  rows: LeadAnalyticsLostReasonRow[];
  t: (k: string) => string;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("leadAnalytics.noLostReasons")}
      </p>
    );
  }
  const total = rows.reduce((s, r) => s + r.count, 0);
  return (
    <div className="relative h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={rows}
            dataKey="count"
            nameKey="reason"
            innerRadius={70}
            outerRadius={100}
            paddingAngle={2}
          >
            {rows.map((r, i) => (
              <Cell key={r.reason} fill={LOST_REASON_COLORS[i % LOST_REASON_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-extrabold text-foreground">{total}</span>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        {rows[0]!.reason} — {t("leadAnalytics.legendLost")}
      </p>
    </div>
  );
}

function StageSpeedChart({ rows, t }: { rows: LeadAnalyticsStageRow[]; t: (k: string) => string }) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("leadAnalytics.noStages")}
      </p>
    );
  }
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ left: -14, right: 8, top: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="stage"
            tickLine={false}
            axisLine={false}
            fontSize={10}
            stroke="var(--color-subtle)"
            interval={0}
            angle={-20}
            textAnchor="end"
            height={50}
          />
          <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-subtle)" />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-accent)" }} />
          <Bar dataKey="avg_days" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChurnRiskTable({
  rows,
  t,
}: {
  rows: LeadAnalyticsChurnRow[];
  t: (k: string, vars?: Record<string, string | number>) => string;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("leadAnalytics.noChurnRisk")}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-subtle">
            <th className="py-2 pr-3">{t("leadAnalytics.colLead")}</th>
            <th className="py-2 pr-3">{t("leadAnalytics.colManager")}</th>
            <th className="py-2 pr-3">{t("leadAnalytics.colLastContact")}</th>
            <th className="py-2 pl-3">{t("leadAnalytics.colRisk")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.lead_id} className="border-b border-border/60 last:border-0">
              <td className="max-w-[140px] truncate py-2 pr-3 font-semibold text-foreground">
                {r.name}
              </td>
              <td className="max-w-[120px] truncate py-2 pr-3 text-muted-foreground">
                {r.manager}
              </td>
              <td className="py-2 pr-3 tabular-nums text-foreground">
                {r.days_since_contact != null
                  ? `${r.days_since_contact}${t("leadAnalytics.daysSuffix")}`
                  : t("leadAnalytics.neverContacted")}
              </td>
              <td className="py-2 pl-3">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-destructive"
                      style={{ width: `${r.risk_percent}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold tabular-nums text-destructive">
                    {r.risk_percent}%
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DirectionTab({
  funnel,
  managerId,
  teamId,
  since,
  t,
}: {
  funnel: string;
  managerId: string;
  teamId: string;
  since: Date | null;
  t: (k: string, vars?: Record<string, string | number>) => string;
}) {
  const { data, isLoading } = useLeadAnalyticsDirection(
    funnel || null,
    managerId || null,
    teamId || null,
    since,
  );
  const { data: currentData, isLoading: currentLoading } = useLeadAnalyticsCurrent(
    funnel || null,
    managerId || null,
    teamId || null,
    since,
  );
  return (
    <>
      <div className="mt-8">
        <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
          04 &nbsp;{t("leadAnalytics.trajectoryTitle")}
        </p>
        <h2 className="mt-1 text-xl font-bold text-foreground">
          {t("leadAnalytics.directionTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("leadAnalytics.directionDesc")}</p>
      </div>

      <div className="mt-4 grid gap-6 xl:grid-cols-2">
        <SectionCard
          title={t("leadAnalytics.trajectoryTitle")}
          description={t("leadAnalytics.trajectoryDesc")}
        >
          {isLoading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-subtle" />
          ) : (
            <TrajectoryDonut
              direction={data?.direction ?? { closingSoon: 0, neutral: 0, losingSoon: 0 }}
              t={t}
            />
          )}
        </SectionCard>

        <SectionCard
          title={t("leadAnalytics.lostReasonsTitle")}
          description={t("leadAnalytics.lostReasonsDesc")}
        >
          {isLoading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-subtle" />
          ) : (
            <LostReasonsDonut rows={data?.lostReasons ?? []} t={t} />
          )}
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SectionCard
          title={t("leadAnalytics.speedTitle")}
          description={t("leadAnalytics.speedDesc")}
        >
          {currentLoading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-subtle" />
          ) : (
            <StageSpeedChart rows={currentData?.stages ?? []} t={t} />
          )}
        </SectionCard>

        <SectionCard
          title={t("leadAnalytics.churnRiskTitle")}
          description={t("leadAnalytics.churnRiskDesc")}
        >
          {isLoading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-subtle" />
          ) : (
            <ChurnRiskTable rows={data?.churnRisk ?? []} t={t} />
          )}
        </SectionCard>
      </div>
    </>
  );
}

const TABS: { key: Tab; icon: typeof Zap; labelKey: string; iconColor: string }[] = [
  { key: "action", icon: Zap, labelKey: "leadAnalytics.tabAction", iconColor: "text-amber-500" },
  {
    key: "quality",
    icon: Layers,
    labelKey: "leadAnalytics.tabQuality",
    iconColor: "text-violet-500",
  },
  {
    key: "current",
    icon: SlidersHorizontal,
    labelKey: "leadAnalytics.tabCurrent",
    iconColor: "text-sky-500",
  },
  {
    key: "direction",
    icon: Shuffle,
    labelKey: "leadAnalytics.tabDirection",
    iconColor: "text-rose-500",
  },
];

function MonthStrip({
  year,
  monthIndex,
  onSelect,
  onPrevYear,
  onNextYear,
  onToday,
  t,
}: {
  year: number;
  monthIndex: number;
  onSelect: (year: number, month: number) => void;
  onPrevYear: () => void;
  onNextYear: () => void;
  onToday: () => void;
  t: (k: string) => string;
}) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-foreground">{year}</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onPrevYear}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onToday}
            className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-bold text-foreground transition-colors hover:bg-accent"
          >
            {t("leadAnalytics.today")}
          </button>
          <button
            type="button"
            onClick={onNextYear}
            disabled={year >= currentYear}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6 xl:grid-cols-12">
        {MONTH_TILE_LABELS.map((label, i) => {
          const isFuture = year > currentYear || (year === currentYear && i > currentMonth);
          const selected = i === monthIndex;
          return (
            <button
              key={label}
              type="button"
              disabled={isFuture}
              onClick={() => onSelect(year, i)}
              className={cn(
                "rounded-xl border px-2 py-2.5 text-center transition-colors",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : isFuture
                    ? "cursor-not-allowed border-border/50 bg-surface/50 text-subtle/50"
                    : "border-border bg-surface text-foreground hover:bg-accent",
              )}
            >
              <p
                className={cn(
                  "text-[10px]",
                  selected ? "text-primary-foreground/80" : "text-subtle",
                )}
              >
                {year}
              </p>
              <p className="text-sm font-bold">{label}</p>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-subtle">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-success" /> {t("leadAnalytics.legendAvailable")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-warning" /> {t("leadAnalytics.legendIncomplete")}
        </span>
      </div>
    </div>
  );
}

function LeadAnalytics() {
  const { t } = useI18n();
  const { format } = useCurrency();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("action");
  const [period, setPeriod] = useState<Period>("monthly");
  const now = useMemo(() => new Date(), []);
  const [monthYear, setMonthYear] = useState(now.getFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getMonth());
  const [funnel, setFunnel] = useState("");
  const [managerId, setManagerId] = useState("");
  const [teamId, setTeamId] = useState("");
  const { names: funnelNames } = useFunnelNames();
  const { data: profiles } = useProfilesRaw();

  const since = useMemo(
    () => periodSince(period, monthYear, monthIndex),
    [period, monthYear, monthIndex],
  );
  const { data, isLoading } = useLeadAnalyticsAction(
    funnel || null,
    managerId || null,
    since,
    teamId || null,
  );

  // The RPCs enforce real scoping (super_admin/platform_owner see everyone,
  // rop sees themself + direct reports, everyone else sees only themself),
  // so picking a team/operator outside that scope would just come back
  // empty. Mirror the same scope here to keep the dropdowns from offering
  // choices the backend will refuse.
  const isUnrestricted = user?.role === "super_admin" || user?.role === "platform_owner";
  const isRop = user?.role === "rop";

  const rops = useMemo(() => {
    const list = (profiles ?? []).filter((p) => p.role === "rop");
    const scoped = isUnrestricted ? list : list.filter((p) => p.id === user?.id);
    return scoped.slice().sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [profiles, isUnrestricted, user?.id]);

  const { data: managerIdsInFunnel } = useManagerIdsInFunnel(funnel || null);

  const managers = useMemo(() => {
    let all = (profiles ?? []).slice();
    if (!isUnrestricted) {
      all = isRop
        ? all.filter((p) => p.id === user?.id || p.manager_id === user?.id)
        : all.filter((p) => p.id === user?.id);
    }
    all = all.sort((a, b) => a.full_name.localeCompare(b.full_name));
    if (teamId) all = all.filter((p) => p.id === teamId || p.manager_id === teamId);
    if (funnel && managerIdsInFunnel) all = all.filter((p) => managerIdsInFunnel.has(p.id));
    return all;
  }, [profiles, teamId, funnel, managerIdsInFunnel, isUnrestricted, isRop, user?.id]);

  const selectedTeamName =
    rops.find((r) => r.id === teamId)?.full_name ?? t("leadAnalytics.allTeams");
  const selectedManagerName =
    managers.find((m) => m.id === managerId)?.full_name ?? t("leadAnalytics.allManagers");
  const selectedFunnelName = funnel || t("leadFilter.allFunnels");

  const PERIODS: { key: Period; labelKey: string }[] = [
    { key: "daily", labelKey: "leadAnalytics.periodDaily" },
    { key: "weekly", labelKey: "leadAnalytics.periodWeekly" },
    { key: "monthly", labelKey: "leadAnalytics.periodMonthly" },
  ];

  return (
    <>
      <PageHeader title={t("leadAnalytics.title")} description={t("leadAnalytics.desc")} />

      <div className="mb-6 inline-flex flex-wrap items-center gap-1 rounded-2xl border border-border bg-card p-1.5 shadow-soft">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            type="button"
            onClick={() => setTab(tb.key)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl bg-surface px-3.5 py-2 text-sm font-semibold ring-1 ring-transparent transition-colors",
              tab === tb.key
                ? "bg-primary/10 text-primary ring-primary/50"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <tb.icon className={cn("h-4 w-4", tb.iconColor)} />
            {t(tb.labelKey)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-1 rounded-2xl border border-border bg-card p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors",
                period === p.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              {t(p.labelKey)}
            </button>
          ))}
        </div>

        <FilterTile icon={Users} label={t("leadAnalytics.jamoaLabel")} value={selectedTeamName}>
          <TileOption
            label={t("leadAnalytics.allTeams")}
            active={!teamId}
            onClick={() => {
              setTeamId("");
              setManagerId("");
            }}
          />
          {rops.map((r) => (
            <TileOption
              key={r.id}
              label={r.full_name}
              active={teamId === r.id}
              onClick={() => {
                setTeamId(r.id);
                setManagerId("");
              }}
            />
          ))}
        </FilterTile>

        <FilterTile
          icon={User}
          label={t("leadAnalytics.operatorLabel")}
          value={selectedManagerName}
        >
          <TileOption
            label={t("leadAnalytics.allManagers")}
            active={!managerId}
            onClick={() => setManagerId("")}
          />
          {managers.map((m) => (
            <TileOption
              key={m.id}
              label={m.full_name}
              active={managerId === m.id}
              onClick={() => setManagerId(m.id)}
            />
          ))}
        </FilterTile>

        <FilterTile
          icon={GitBranch}
          label={t("leadAnalytics.funnelLabel")}
          value={selectedFunnelName}
        >
          <TileOption
            label={t("leadFilter.allFunnels")}
            active={!funnel}
            onClick={() => {
              setFunnel("");
              setManagerId("");
            }}
          />
          {funnelNames.map((f) => (
            <TileOption
              key={f}
              label={f}
              active={funnel === f}
              onClick={() => {
                setFunnel(f);
                setManagerId("");
              }}
            />
          ))}
        </FilterTile>
      </div>

      {period === "monthly" && (
        <MonthStrip
          year={monthYear}
          monthIndex={monthIndex}
          onSelect={(y, m) => {
            setMonthYear(y);
            setMonthIndex(m);
          }}
          onPrevYear={() => setMonthYear((y) => y - 1)}
          onNextYear={() => setMonthYear((y) => y + 1)}
          onToday={() => {
            setMonthYear(now.getFullYear());
            setMonthIndex(now.getMonth());
          }}
          t={t}
        />
      )}

      <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("leadAnalytics.kpiTotalLeads")}
          value={String(data?.totalLeads ?? 0)}
          hint={t("leadAnalytics.kpiTotalLeadsHint")}
        />
        <StatCard
          label={t("leadAnalytics.kpiAvgConversion")}
          value={`${data?.avgConversion ?? 0}%`}
          hint={t("leadAnalytics.kpiAvgConversionHint")}
        />
        <StatCard
          label={t("leadAnalytics.kpiHotLeads")}
          value={String(data?.hotLeads ?? 0)}
          tone="mint"
          hint={t("leadAnalytics.kpiHotLeadsHint")}
        />
        <StatCard
          label={t("leadAnalytics.kpiChurnRisk")}
          value={String(data?.churnRisk ?? 0)}
          tone="danger-soft"
          hint={t("leadAnalytics.kpiChurnRiskHint")}
        />
      </div>

      {tab === "action" ? (
        <ActionTab data={data} isLoading={isLoading} format={format} t={t} />
      ) : tab === "quality" ? (
        <QualityTab funnel={funnel} managerId={managerId} teamId={teamId} since={since} t={t} />
      ) : tab === "current" ? (
        <CurrentTab funnel={funnel} managerId={managerId} teamId={teamId} since={since} t={t} />
      ) : (
        <DirectionTab funnel={funnel} managerId={managerId} teamId={teamId} since={since} t={t} />
      )}
    </>
  );
}
