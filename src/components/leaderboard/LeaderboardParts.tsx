import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Crown, Medal, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeaderboardRow } from "@/lib/leaderboard-engine";
import type { RankMove } from "@/hooks/use-leaderboard";

/* ---------------- animated counter ---------------- */

export function AnimatedNumber({
  value,
  format,
  className,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    const b = value;
    if (a === b) return;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / 700);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(a + (b - a) * eased);
      if (p < 1) raf.current = requestAnimationFrame(step);
      else from.current = b;
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      from.current = display;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span className={className}>{format(display)}</span>;
}

/* ---------------- rank delta badge ---------------- */

export function RankDelta({ move }: { move?: RankMove }) {
  if (!move || move.delta === 0) return <span className="text-xs text-subtle">—</span>;
  const up = move.delta > 0;
  return (
    <span
      className={cn(
        "inline-flex animate-in fade-in slide-in-from-bottom-1 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold duration-500",
        up ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
      )}
    >
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {up ? "+" : ""}
      {move.delta}
    </span>
  );
}

/* ---------------- avatar ---------------- */

export function Avatar({ row, size = 40 }: { row: LeaderboardRow; size?: number }) {
  const { employee } = row;
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-xl text-xs font-semibold text-foreground"
      style={{
        width: size,
        height: size,
        background: `oklch(0.93 0.06 ${employee.avatarHue})`,
      }}
    >
      {employee.initials}
    </span>
  );
}

/* ---------------- progress ---------------- */

export function Progress({ percent, tone }: { percent: number; tone?: "gold" | "default" }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-700 ease-out",
          percent >= 100 ? "bg-success" : tone === "gold" ? "bg-warning" : "bg-primary",
        )}
        style={{ width: `${Math.min(100, Math.max(2, percent))}%` }}
      />
    </div>
  );
}

/* ---------------- podium ---------------- */

const PODIUM = [
  { icon: Crown, label: "Gold", ring: "ring-[#E9B949]/50", glow: "0 0 0 1px oklch(0.86 0.14 85 / 0.35), 0 18px 40px -18px oklch(0.82 0.15 85 / 0.55)" },
  { icon: Medal, label: "Silver", ring: "ring-[#B9C0C9]/50", glow: "0 0 0 1px oklch(0.85 0.01 250 / 0.5), 0 16px 36px -20px oklch(0.7 0.02 250 / 0.5)" },
  { icon: Award, label: "Bronze", ring: "ring-[#C99B6B]/50", glow: "0 0 0 1px oklch(0.78 0.07 60 / 0.45), 0 16px 36px -20px oklch(0.68 0.09 60 / 0.5)" },
];

export function PodiumCard({
  row,
  place,
  move,
  metricLabel,
}: {
  row: LeaderboardRow;
  place: number;
  move?: RankMove;
  metricLabel: string;
}) {
  const style = PODIUM[place] ?? PODIUM[2]!;
  const Icon = style.icon;
  return (
    <div
      className={cn("surface-card relative overflow-hidden p-6 ring-1 transition-shadow duration-500", style.ring)}
      style={{ boxShadow: style.glow }}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-mint/40 blur-2xl" />
      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Avatar row={row} size={44} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{row.employee.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {row.employee.position} · {row.employee.department}
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-background px-2 py-1 text-[11px] font-semibold text-muted-foreground">
          <Icon className="h-3.5 w-3.5 animate-pulse text-warning" />
          {style.label}
        </span>
      </div>

      <p className="relative mt-5 text-[26px] font-semibold tracking-tight">
        <AnimatedNumber value={row.metricValue} format={() => metricLabel} />
      </p>
      <div className="relative mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        <span>#{row.rank}</span>
        <RankDelta {...(move ? { move } : {})} />
        <span>· {row.employee.dealsClosed} deals · {row.bonus}% bonus</span>
      </div>

      <div className="relative mt-4">
        <Progress percent={row.targetCompletion} tone={place === 0 ? "gold" : "default"} />
        <div className="mt-2 flex justify-between text-[11px] text-subtle">
          <span>Monthly KPI {row.monthlyKpi.toFixed(0)}%</span>
          <span>Daily KPI {row.dailyKpi.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}
