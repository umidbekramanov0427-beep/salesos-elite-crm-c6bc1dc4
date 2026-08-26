import { useId } from "react";
import { cn } from "@/lib/utils";

// Full splash lockup for decorative/marketing placements (the login
// screen's branding panel): the same two-line crossing mark as
// Logo.tsx — a dark-green-to-light-green front line over a lighter
// green line underneath, crossing once and flicking upward at the end
// — plus the "SalesOS Elite CRM" wordmark on one line beneath it. The
// small in-app icon used everywhere else (sidebar, compact headers)
// stays Logo.tsx — this version is only meant for a larger, decorative
// size.
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

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <svg
        viewBox="0 0 100 56"
        fill="none"
        className={cn("h-14 w-24", iconClassName)}
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id={heroGrad}
            x1="4"
            y1="50"
            x2="98"
            y2="3"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#14532D" />
            <stop offset="1" stopColor="#4ADE80" />
          </linearGradient>
        </defs>
        <path
          d="M4,44 C22,40 36,32 50,30 C64,28 78,22 90,26 C94,27 97,29 100,31"
          stroke="#16A34A"
          strokeOpacity="0.75"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M4,50 C20,42 32,20 48,18 C62,16 74,28 86,24 C92,22 94,12 98,3"
          stroke={`url(#${heroGrad})`}
          strokeWidth="2.6"
          strokeLinecap="round"
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
