import { useId } from "react";
import { cn } from "@/lib/utils";

// Full splash lockup for decorative/marketing placements (the login
// screen's branding panel): the same crossing-wave mark as Logo.tsx —
// a bright emerald/teal "hero" wave with a soft glow, crossing two
// fainter muted waves behind it — plus the "SalesOS Elite CRM"
// wordmark on one line beneath it. The small in-app icon used
// everywhere else (sidebar, compact headers) stays Logo.tsx — this
// version is only meant for a larger, decorative size.
export function BrandMark({
  className,
  iconClassName,
  wordmarkClassName,
}: {
  className?: string;
  iconClassName?: string;
  wordmarkClassName?: string;
}) {
  const heroGrad = useId();
  const glowId = useId();

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <svg
        viewBox="0 0 100 100"
        fill="none"
        className={cn("h-16 w-16", iconClassName)}
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id={heroGrad}
            x1="4"
            y1="60"
            x2="96"
            y2="35"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#10B981" />
            <stop offset="1" stopColor="#5EEAD4" />
          </linearGradient>
          <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d="M6 68 C24 45 40 80 55 60 C70 40 84 72 94 50"
          stroke="#64748B"
          strokeOpacity="0.28"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M6 40 C22 65 38 20 52 50 C68 75 82 30 94 55"
          stroke="#94A3B8"
          strokeOpacity="0.4"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M6 55 C20 25 35 70 50 45 C65 20 80 60 94 35"
          stroke={`url(#${heroGrad})`}
          strokeWidth="5.5"
          strokeLinecap="round"
          filter={`url(#${glowId})`}
        />
      </svg>

      <p
        className={cn(
          "whitespace-nowrap text-xl font-extrabold tracking-tight text-emerald-400",
          wordmarkClassName,
        )}
      >
        SalesOS Elite CRM
      </p>
    </div>
  );
}
