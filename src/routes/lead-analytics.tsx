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
import { Loader2, Zap, Layers, SlidersHorizontal, Shuffle, GitBranch, User } from "lucide-react";
import { PageHeader, SectionCard, StatCard, Pill } from "@/components/layout/Primitives";
import {
  useFunnelNames,
  useProfilesRaw,
  useLeadAnalyticsAction,
  useLeadAnalyticsQuality,
  useLeadAnalyticsCurrent,
  type LeadAnalyticsRecoverableRow,
  type LeadAnalyticsHotRow,
  type LeadAnalyticsTagResultRow,
  type LeadAnalyticsTagMatrixRow,
  type LeadAnalyticsTagCategoryRow,
  type LeadAnalyticsStageRow,
  type LeadAnalyticsManagerLoadRow,
} from "@/hooks/use-crm-data";
import { useCurrency } from "@/lib/currency";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { PermissionGate } from "@/components/PermissionGate";
import { FilterSelect } from "@/components/filters/FilterSelect";

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

function periodSince(period: Period): Date | null {
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
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return null;
}

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
  t,
}: {
  funnel: string;
  managerId: string;
  t: (k: string, vars?: Record<string, string | number>) => string;
}) {
  const { data, isLoading } = useLeadAnalyticsQuality(funnel || null, managerId || null);
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
  t,
}: {
  funnel: string;
  managerId: string;
  t: (k: string, vars?: Record<string, string | number>) => string;
}) {
  const { data, isLoading } = useLeadAnalyticsCurrent(funnel || null, managerId || null);
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

const TABS: { key: Tab; icon: typeof Zap; labelKey: string }[] = [
  { key: "action", icon: Zap, labelKey: "leadAnalytics.tabAction" },
  { key: "quality", icon: Layers, labelKey: "leadAnalytics.tabQuality" },
  { key: "current", icon: SlidersHorizontal, labelKey: "leadAnalytics.tabCurrent" },
  { key: "direction", icon: Shuffle, labelKey: "leadAnalytics.tabDirection" },
];

function LeadAnalytics() {
  const { t } = useI18n();
  const { format } = useCurrency();
  const [tab, setTab] = useState<Tab>("action");
  const [period, setPeriod] = useState<Period>("monthly");
  const [funnel, setFunnel] = useState("");
  const [managerId, setManagerId] = useState("");
  const { names: funnelNames } = useFunnelNames();
  const { data: profiles } = useProfilesRaw();

  const since = useMemo(() => periodSince(period), [period]);
  const { data, isLoading } = useLeadAnalyticsAction(funnel || null, managerId || null, since);

  const managers = useMemo(
    () => (profiles ?? []).slice().sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [profiles],
  );

  const PERIODS: { key: Period; labelKey: string }[] = [
    { key: "daily", labelKey: "leadAnalytics.periodDaily" },
    { key: "weekly", labelKey: "leadAnalytics.periodWeekly" },
    { key: "monthly", labelKey: "leadAnalytics.periodMonthly" },
    { key: "all", labelKey: "leadAnalytics.periodCustom" },
  ];

  return (
    <>
      <PageHeader title={t("leadAnalytics.title")} description={t("leadAnalytics.desc")} />

      <div className="mb-6 flex flex-wrap items-center gap-1 rounded-2xl border border-border bg-card p-1.5 shadow-soft">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            type="button"
            onClick={() => setTab(tb.key)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors",
              tab === tb.key
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <tb.icon className="h-4 w-4" />
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
        <FilterSelect icon={User} value={managerId} onChange={setManagerId}>
          <option value="">{t("leadAnalytics.allManagers")}</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect icon={GitBranch} value={funnel} onChange={setFunnel}>
          <option value="">{t("leadFilter.allFunnels")}</option>
          {funnelNames.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </FilterSelect>
      </div>

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
        <QualityTab funnel={funnel} managerId={managerId} t={t} />
      ) : tab === "current" ? (
        <CurrentTab funnel={funnel} managerId={managerId} t={t} />
      ) : (
        <div className="mt-8">
          <SectionCard title={t(TABS.find((tb) => tb.key === tab)!.labelKey)}>
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("leadAnalytics.comingSoon")}
            </p>
          </SectionCard>
        </div>
      )}
    </>
  );
}
