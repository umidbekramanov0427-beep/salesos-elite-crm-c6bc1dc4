import { createFileRoute } from "@tanstack/react-router";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Sparkles } from "lucide-react";
import { PageHeader, SectionCard, StatCard, Pill } from "@/components/layout/Primitives";
import { REVENUE_SERIES, TASKS, currency } from "@/lib/mock-data";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — SalesOS Elite" },
      { name: "description", content: "Revenue, MRR, pipeline and today's sales metrics in one premium command center." },
      { property: "og:title", content: "Dashboard — SalesOS Elite" },
      { property: "og:description", content: "Revenue, MRR, pipeline and today's sales metrics." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <>
      <PageHeader title="Dashboard" description="Everything happening across revenue today, in one calm surface." />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue (MTD)" value={currency(768050)} delta={9.3} hint="vs July" tone="mint" />
        <StatCard label="MRR" value={currency(214300)} delta={4.1} hint="net of churn" />
        <StatCard label="Open pipeline" value={currency(1042000)} delta={7.6} hint="128 active deals" />
        <StatCard label="Tasks due today" value="14" delta={-12} hint="3 overdue" />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <SectionCard title="Revenue vs pipeline" description="Last 8 months" className="xl:col-span-2">
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={REVENUE_SERIES} margin={{ left: -18, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="pipe" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-success)" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="var(--color-success)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} stroke="var(--color-subtle)" />
                <YAxis tickFormatter={(v) => `${v / 1000}k`} tickLine={false} axisLine={false} fontSize={12} stroke="var(--color-subtle)" />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--color-border)",
                    boxShadow: "var(--shadow-elevated)",
                    fontSize: 12,
                  }}
                  formatter={(v: number) => currency(v)}
                />
                <Area type="monotone" dataKey="pipeline" stroke="var(--color-success)" strokeWidth={2} fill="url(#pipe)" />
                <Area type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={2} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <div className="space-y-6">
          <div className="mint-card p-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-mint-foreground" />
              <p className="text-sm font-semibold">AI summary</p>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Pipeline coverage is 3.1x against the August target — healthy. Two enterprise deals worth{" "}
              {currency(146500)} have been stuck in Negotiation for 9+ days. Pricing objections rose 18% this week,
              concentrated in the SMB team.
            </p>
            <p className="mt-4 text-xs font-medium text-mint-foreground">Recommended: run an objection-handling review with SMB.</p>
          </div>

          <SectionCard title="Today's focus">
            <ul className="space-y-4">
              {TASKS.slice(0, 4).map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{t.title}</p>
                    <p className="mt-1 text-xs text-subtle">{t.assignee} · {t.due}</p>
                  </div>
                  <Pill tone={t.priority === "Urgent" ? "danger" : t.priority === "High" ? "warning" : "neutral"}>
                    {t.priority}
                  </Pill>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
