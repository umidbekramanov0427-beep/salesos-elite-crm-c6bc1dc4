import { useEffect, useRef, useState } from "react";

/** Animates a numeric value from 0 to `value` once on mount. */
export function useCountUp(value: number, duration = 900) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(value * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, duration]);

  return display;
}

/** Splits "$48,200" / "34.8%" / "87 / 100" into prefix + number + suffix. */
export function AnimatedValue({ value, className }: { value: string; className?: string }) {
  const match = value.match(/^([^\d-]*)([\d.,]+)(.*)$/);
  const numeric = match ? Number(match[2].replace(/,/g, "")) : 0;
  const animated = useCountUp(numeric);
  if (!match) return <span className={className}>{value}</span>;

  const decimals = match[2].includes(".") ? 1 : 0;
  const formatted = animated.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span className={className}>
      {match[1]}
      {formatted}
      {match[3]}
    </span>
  );
}
