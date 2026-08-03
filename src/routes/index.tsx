import { createFileRoute } from "@tanstack/react-router";
import { Crown, Medal, TrendingUp } from "lucide-react";
import { PageHeader, SectionCard, StatCard, Pill } from "@/components/layout/Primitives";
import { REPS, currency } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SalesOS Elite CRM" },
      { name: "description", content: "Real-time sales rep ranking, monthly targets, bonus tracking and department comparison." },
      { property: "og:title", content: "SalesOS Elite CRM" },
      { property: "og:description", content: "Real-time sales rep ranking, monthly targets, bonus tracking and department comparison." },
    ],
  }),
  component: Leaderboard,
});

function Leaderboard() {
  const ranked = [...REPS].sort((a, b) => b.revenue - a.revenue);
  const total = ranked.reduce((s, r) => s + r.revenue, 0);
  const target = ranked.reduce((s, r) => s + r.target, 0);
  const qualified = ranked.filter((r) => r.revenue >= r.target).length;

  return (
    <>
      <PageHeader
        title="Leaderboard"
        description="Live ranking across the revenue org. Bonus of 5% unlocks the moment a rep crosses 100% of monthly target."
        actions={<Pill tone="info">August 2026 · live</Pill>}
      />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Team revenue" value={currency(total)} delta={11.8} hint="vs last month" tone="mint" />
        <StatCard label="Team target" value={currency(target)} hint={`${Math.round((total / target) * 100)}% attained`} />
        <StatCard label="Bonus qualified" value={`${qualified} of ${ranked.length}`} hint="5% bonus unlocked" />
        <StatCard label="Avg win rate" value={`${Math.round(ranked.reduce((s, r) => s + r.winRate, 0) / ranked.length)}%`} delta={2.4} hint="rolling 30 days" />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        {ranked.slice(0, 3).map((rep, i) => (
          <div key={rep.id} className={cn("p-6", i === 0 ? "mint-card" : "surface-card")}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-background text-sm font-semibold text-foreground shadow-soft">
                  {rep.name.split(" ").map((n) => n[0]).join("")}
                </span>
                <div>
                  <p className="font-semibold text-foreground">{rep.name}</p>
                  <p className="text-xs text-muted-foreground">{rep.role} · {rep.department}</p>
                </div>
              </div>
              {i === 0 ? <Crown className="h-5 w-5 text-warning" /> : <Medal className="h-5 w-5 text-subtle" />}
            </div>
            <p className="mt-6 text-[28px] font-semibold tracking-tight">{currency(rep.revenue)}</p>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-border">
              <div
                className={cn("h-full rounded-full", rep.revenue >= rep.target ? "bg-success" : "bg-primary")}
                style={{ width: `${Math.min(100, (rep.revenue / rep.target) * 100)}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>{Math.round((rep.revenue / rep.target) * 100)}% of {currency(rep.target)}</span>
              <span className={rep.trend >= 0 ? "text-success" : "text-destructive"}>
                {rep.trend >= 0 ? "+" : ""}{rep.trend}%
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <SectionCard title="Full ranking" description="Revenue, activity and bonus status for the current period" className="overflow-hidden">
          <div className="-m-6 overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-subtle">
                  <th className="px-6 py-3 font-medium">#</th>
                  <th className="px-6 py-3 font-medium">Employee</th>
                  <th className="px-6 py-3 font-medium">Department</th>
                  <th className="px-6 py-3 font-medium">Revenue</th>
                  <th className="px-6 py-3 font-medium">Target</th>
                  <th className="px-6 py-3 font-medium">Deals</th>
                  <th className="px-6 py-3 font-medium">Calls</th>
                  <th className="px-6 py-3 font-medium">Win rate</th>
                  <th className="px-6 py-3 font-medium">Bonus</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((rep, i) => (
                  <tr key={rep.id} className="border-b border-border last:border-0 transition-colors hover:bg-surface">
                    <td className="px-6 py-4 text-muted-foreground">{i + 1}</td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-foreground">{rep.name}</p>
                      <p className="text-xs text-subtle">{rep.role}</p>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{rep.department}</td>
                    <td className="px-6 py-4 font-medium">{currency(rep.revenue)}</td>
                    <td className="px-6 py-4 text-muted-foreground">{currency(rep.target)}</td>
                    <td className="px-6 py-4 text-muted-foreground">{rep.deals}</td>
                    <td className="px-6 py-4 text-muted-foreground">{rep.calls}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <TrendingUp className="h-3.5 w-3.5 text-subtle" /> {rep.winRate}%
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {rep.revenue >= rep.target ? (
                        <Pill tone="success">{currency(rep.revenue * 0.05)}</Pill>
                      ) : (
                        <Pill>Pending</Pill>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </>
  );
}
