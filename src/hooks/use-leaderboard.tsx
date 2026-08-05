import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  type BonusConfig,
  DEFAULT_BONUS_CONFIG,
  type Employee,
  type Filters,
  type LeaderboardRow,
  buildInsights,
  buildRows,
  generateRoster,
  tickRoster,
} from "@/lib/leaderboard-engine";

export const REFRESH_MS = 3000;

export type RankMove = { delta: number; at: number };

export function useLeaderboard(initialFilters: Filters) {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [bonusConfig, setBonusConfig] = useState<BonusConfig>(DEFAULT_BONUS_CONFIG);
  const [roster, setRoster] = useState<Employee[]>(() => generateRoster());
  const [live, setLive] = useState(true);
  const [lastTick, setLastTick] = useState<number>(() => Date.now());

  const [moves, setMoves] = useState<Record<string, RankMove>>({});
  const prevRanks = useRef<Map<string, number>>(new Map());
  const milestones = useRef<Set<string>>(new Set());

  // 3s incremental tick — only the changed employees are replaced.
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => {
      setRoster((cur) => tickRoster(cur).next);
      setLastTick(Date.now());
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [live]);

  const rows = useMemo(() => buildRows(roster, filters, bonusConfig), [roster, filters, bonusConfig]);
  const insights = useMemo(() => buildInsights(rows), [rows]);

  // Rank movement + milestone notifications
  useEffect(() => {
    const nextMoves: Record<string, RankMove> = {};
    const now = Date.now();
    for (const r of rows) {
      const prev = prevRanks.current.get(r.employee.id);
      if (prev !== undefined && prev !== r.rank) {
        nextMoves[r.employee.id] = { delta: prev - r.rank, at: now };
      }
      prevRanks.current.set(r.employee.id, r.rank);
    }
    if (Object.keys(nextMoves).length) {
      setMoves((cur) => ({ ...cur, ...nextMoves }));
      window.setTimeout(() => {
        setMoves((cur) => {
          const copy = { ...cur };
          for (const id of Object.keys(cur)) if (now - copy[id]!.at >= 2000) delete copy[id];
          return copy;
        });
      }, 2100);
    }

    const first = rows[0];
    if (first) {
      notifyOnce(milestones, `top1:${first.employee.id}`, `🥇 ${first.employee.name} is now #1`, first.metricLabel);
    }
    for (const r of rows.slice(0, 3)) {
      notifyOnce(milestones, `top3:${r.employee.id}`, `🏅 ${r.employee.name} entered the Top 3`, `Rank #${r.rank}`);
    }
    for (const r of rows) {
      if (r.monthlyKpi >= 100) {
        notifyOnce(
          milestones,
          `target:${r.employee.id}`,
          `🎯 ${r.employee.name} hit the monthly target`,
          `${r.monthlyKpi.toFixed(0)}% attained · ${r.bonus}% bonus unlocked`,
        );
      }
      if (r.employee.dealsClosed >= 100) {
        notifyOnce(milestones, `deals100:${r.employee.id}`, `💼 ${r.employee.name} closed 100 deals`, "Milestone reached");
      }
      if (r.employee.monthlyRevenue >= 250000) {
        notifyOnce(milestones, `rev250:${r.employee.id}`, `🚀 ${r.employee.name} passed $250k`, "Revenue milestone");
      }
    }
  }, [rows]);

  const patchFilters = useCallback((patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch })), []);

  /** Manual refresh — pulls the latest tick immediately without a page reload. */
  const refresh = useCallback(() => {
    setRoster((cur) => tickRoster(cur).next);
    setLastTick(Date.now());
  }, []);

  const resetFilters = useCallback(() => setFilters(initialFilters), [initialFilters]);

  return {
    rows,
    insights,
    filters,
    patchFilters,
    resetFilters,
    bonusConfig,
    setBonusConfig,
    moves,
    live,
    setLive,
    lastTick,
    refresh,
  };
}

function notifyOnce(seen: React.RefObject<Set<string>>, key: string, title: string, description: string) {
  const set = seen.current;
  if (!set || set.has(key)) return;
  set.add(key);
  // Skip the very first hydration burst of "already true" milestones.
  if (set.size > 24) return;
  toast(title, { description });
}

export type { LeaderboardRow };
