import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, FileSpreadsheet, Filter } from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/layout/Primitives";
import { currency } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useFunnelFlow, usePipelineStageStats, useRevenueSeries } from "@/hooks/use-crm-data";
import { useI18n } from "@/lib/i18n";

function ChooseFunnelPrompt() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center">
      <Filter className="h-5 w-5 text-subtle" />
      <p className="text-sm font-medium text-muted-foreground">{t("charts.chooseFunnel")}</p>
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

export function RevenueChart() {
  const { t } = useI18n();
  const data = useRevenueSeries();

  return (
    <SectionCard
      title={t("charts.revenue.title")}
      description={t("charts.revenue.desc")}
      className="xl:col-span-2"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => toast.success(t("charts.revenue.pdfQueued"))}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Download className="h-3.5 w-3.5" /> {t("charts.pdf")}
          </button>
          <button
            onClick={() => toast.success(t("charts.revenue.excelQueued"))}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> {t("charts.excel")}
          </button>
        </div>
      }
    >
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={[...data]} margin={{ left: -14, right: 8, top: 8 }}>
            <defs>
              <linearGradient id="dash-rev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.24} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="dash-pipe" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-success)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--color-success)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              fontSize={12}
              stroke="var(--color-subtle)"
            />
            <YAxis
              tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
              tickLine={false}
              axisLine={false}
              fontSize={12}
              stroke="var(--color-subtle)"
            />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => currency(v)} />
            <Area
              type="monotone"
              dataKey="pipeline"
              stroke="var(--color-success)"
              strokeWidth={2}
              fill="url(#dash-pipe)"
              animationDuration={700}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="var(--color-primary)"
              strokeWidth={2}
              fill="url(#dash-rev)"
              animationDuration={700}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

export function PipelineChart({ funnel }: { funnel: string | null }) {
  const { t } = useI18n();
  const stats = usePipelineStageStats(funnel);
  if (!funnel) {
    return (
      <SectionCard title={t("charts.pipeline.title")} description={t("charts.pipeline.desc")}>
        <ChooseFunnelPrompt />
      </SectionCard>
    );
  }
  return (
    <SectionCard title={t("charts.pipeline.title")} description={t("charts.pipeline.desc")}>
      <div className="h-[180px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats} margin={{ left: -18, right: 8, top: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="stage"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              stroke="var(--color-subtle)"
              interval={0}
            />
            <YAxis
              tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
              tickLine={false}
              axisLine={false}
              fontSize={11}
              stroke="var(--color-subtle)"
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v: number) => currency(v)}
              cursor={{ fill: "var(--color-accent)" }}
            />
            <Bar dataKey="value" radius={[8, 8, 4, 4]} animationDuration={700}>
              {stats.map((s) => (
                <Cell
                  key={s.stage}
                  fill={
                    s.stage === "Lost"
                      ? "var(--color-destructive)"
                      : s.stage === "Won"
                        ? "var(--color-success)"
                        : "var(--color-primary)"
                  }
                  fillOpacity={s.stage === "Won" || s.stage === "Lost" ? 0.85 : 0.75}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 text-center">
        {stats.slice(0, 3).map((s) => (
          <div key={s.stage}>
            <dt className="text-[11px] text-subtle">{s.stage}</dt>
            <dd className="mt-1 text-sm font-semibold text-foreground">
              {t("charts.pipeline.deals", { count: s.deals })}
            </dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  );
}

export function SalesFunnel({ funnel }: { funnel: string | null }) {
  const { t } = useI18n();
  const flow = useFunnelFlow(funnel);
  const max = flow[0]?.count ?? 1;
  if (!funnel) {
    return (
      <SectionCard title={t("charts.funnel.title")} description={t("charts.funnel.desc")}>
        <ChooseFunnelPrompt />
      </SectionCard>
    );
  }
  return (
    <SectionCard title={t("charts.funnel.title")} description={t("charts.funnel.desc")}>
      <ol className="space-y-3">
        {flow.map((s) => (
          <li key={s.stage}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-foreground">{s.stage}</span>
              <span className="text-xs text-subtle">
                {s.count.toLocaleString()} · {s.conversion}%
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-700 ease-out",
                  s.stage === "Lost"
                    ? "bg-destructive"
                    : s.stage === "Won"
                      ? "bg-success"
                      : "bg-primary",
                )}
                style={{ width: `${(s.count / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}
