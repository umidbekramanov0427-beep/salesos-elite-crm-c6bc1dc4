import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { currency } from "@/lib/mock-data";
import type { LeaderboardRow, MetricDef } from "@/lib/leaderboard-engine";
import type { RankMove } from "@/hooks/use-leaderboard";
import { AnimatedNumber, Avatar, Progress, RankDelta } from "./LeaderboardParts";
import { useI18n } from "@/lib/i18n";

const ROW_H = 68;
const OVERSCAN = 6;

/**
 * Virtualized, position-animated ranking board.
 * Rows are absolutely positioned by rank so a rank change animates as a
 * smooth translate instead of a DOM reorder jump. Only the visible window
 * (plus overscan) is rendered, so 1000+ employees stay smooth.
 */
export function RankingBoard({
  rows,
  moves,
  metric,
  height = 620,
  onSelect,
  bonusHint,
}: {
  rows: LeaderboardRow[];
  moves: Record<string, RankMove>;
  metric: MetricDef;
  height?: number;
  onSelect?: (row: LeaderboardRow) => void;
  bonusHint?: (row: LeaderboardRow) => string;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const end = Math.min(rows.length, Math.ceil((scrollTop + height) / ROW_H) + OVERSCAN);
  const visible = rows.slice(start, end);

  if (rows.length === 0) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">{t("lb.noMatch")}</p>
        <p className="text-xs text-subtle">{t("lb.noMatchHint")}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-[52px_minmax(0,2.2fr)_minmax(0,1.1fr)_repeat(4,minmax(0,0.85fr))_minmax(0,1.2fr)] gap-3 border-b border-border px-4 pb-2 text-[11px] uppercase tracking-wide text-subtle">
        <span>{t("col.rank")}</span>
        <span>{t("col.employee")}</span>
        <span>{metric.label}</span>
        <span className="text-right">{t("col.revenue")}</span>
        <span className="text-right">{t("col.deals")}</span>
        <span className="text-right">{t("col.dailyKpi")}</span>
        <span className="text-right">{t("col.bonus")}</span>
        <span>{t("col.target")}</span>
      </div>

      <div ref={ref} className="relative overflow-y-auto" style={{ height }}>
        <div style={{ height: rows.length * ROW_H }} className="relative">
          {visible.map((row) => {
            const move = moves[row.employee.id];
            return (
              <div
                key={row.employee.id}
                className={cn(
                  "absolute left-0 right-0 grid grid-cols-[52px_minmax(0,2.2fr)_minmax(0,1.1fr)_repeat(4,minmax(0,0.85fr))_minmax(0,1.2fr)] items-center gap-3 rounded-xl px-4 transition-[transform,background-color] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-surface",
                  move && "bg-mint/50",
                )}
                style={{ height: ROW_H - 6, transform: `translateY(${(row.rank - 1) * ROW_H}px)` }}
              >
                <div className="flex items-center gap-1">
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      row.rank <= 3 ? "text-warning" : "text-muted-foreground",
                    )}
                  >
                    {row.rank}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onSelect?.(row)}
                  className="flex min-w-0 items-center gap-3 text-left"
                >
                  <Avatar row={row} size={34} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground hover:text-primary hover:underline">
                      {row.employee.name}
                    </p>
                    <p className="truncate text-[11px] text-subtle">
                      {row.employee.position} · {row.employee.department} · {row.employee.branch}
                    </p>
                  </div>
                </button>

                <span className="truncate text-sm font-semibold tabular-nums">{row.metricLabel}</span>

                <AnimatedNumber
                  className="text-right text-sm tabular-nums text-muted-foreground"
                  value={row.revenue}
                  format={(n) => currency(n)}
                />
                <AnimatedNumber
                  className="text-right text-sm tabular-nums text-muted-foreground"
                  value={row.employee.dealsClosed}
                  format={(n) => `${Math.round(n)}`}
                />
                <AnimatedNumber
                  className="text-right text-sm tabular-nums text-muted-foreground"
                  value={row.dailyKpi}
                  format={(n) => `${n.toFixed(0)}%`}
                />
                <span
                  title={bonusHint?.(row)}
                  className={cn(
                    "cursor-help text-right text-sm font-medium tabular-nums",
                    row.bonus > 0 ? "text-success" : "text-subtle",
                  )}
                >
                  {row.bonus}%
                </span>

                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <Progress percent={row.targetCompletion} />
                  </div>
                  <span className="w-10 text-right text-[11px] tabular-nums text-subtle">
                    {row.targetCompletion.toFixed(0)}%
                  </span>
                  <RankDelta {...(move ? { move } : {})} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
