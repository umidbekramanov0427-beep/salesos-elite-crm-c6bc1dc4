import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader, SectionCard, StatCard } from "@/components/layout/Primitives";
import { REPS, REVENUE_SERIES, currency } from "@/lib/mock-data";
import { useI18n } from "@/lib/i18n";
import { PermissionGate } from "@/components/PermissionGate";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — SalesOS Elite" },
      {
        name: "description",
        content:
          "Sales reports, employee performance, monthly and yearly trends, revenue forecasting.",
      },
      { property: "og:title", content: "Analytics — SalesOS Elite" },
      { property: "og:description", content: "Sales reports, trends and revenue forecasting." },
    ],
  }),
  component: AnalyticsGated,
});

function AnalyticsGated() {
  return (
    <PermissionGate action="View reports">
      <Analytics />
    </PermissionGate>
  );
}

function Analytics() {
  const { t } = useI18n();
  const perRep = REPS.map((r) => ({ name: r.name.split(" ")[0], revenue: r.revenue }));
  return (
    <>
      <PageHeader title={t("analytics.title")} description={t("analytics.desc")} />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("analytics.forecast")}
          value={currency(812000)}
          delta={5.7}
          hint={t("analytics.weightedPipeline")}
          tone="mint"
        />
        <StatCard
          label={t("analytics.ytdRevenue")}
          value={currency(4598050)}
          delta={18.2}
          hint={t("analytics.vsLastYear")}
        />
        <StatCard
          label={t("analytics.avgDealSize")}
          value={currency(31400)}
          delta={2.9}
          hint={t("analytics.rolling90")}
        />
        <StatCard
          label={t("analytics.churn")}
          value="1.8%"
          delta={-0.4}
          hint={t("analytics.logoChurn")}
        />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <SectionCard title={t("analytics.monthlyTrend")}>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={REVENUE_SERIES} margin={{ left: -18, right: 8, top: 8 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  stroke="var(--color-subtle)"
                />
                <YAxis
                  tickFormatter={(v) => `${v / 1000}k`}
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  stroke="var(--color-subtle)"
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--color-border)",
                    fontSize: 12,
                  }}
                  formatter={(v: number) => currency(v)}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--color-primary)"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title={t("analytics.revenueByEmployee")}>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perRep} margin={{ left: -18, right: 8, top: 8 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  stroke="var(--color-subtle)"
                />
                <YAxis
                  tickFormatter={(v) => `${v / 1000}k`}
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  stroke="var(--color-subtle)"
                />
                <Tooltip
                  cursor={{ fill: "var(--color-surface)" }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--color-border)",
                    fontSize: 12,
                  }}
                  formatter={(v: number) => currency(v)}
                />
                <Bar
                  dataKey="revenue"
                  fill="var(--color-primary)"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={44}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>
    </>
  );
}
