import { useId } from "react";
import { cn } from "@/lib/utils";

// Full splash lockup for decorative/marketing placements (the login
// screen's branding panel): the same thin crossing-wave mark as
// Logo.tsx — a glowing dark-green-to-light-green hero line over three
// fainter, thinner green lines — plus the "SalesOS Elite CRM" wordmark
// on one line beneath it. The small in-app icon used everywhere else
// (sidebar, compact headers) stays Logo.tsx — this version is only
// meant for a larger, decorative size.
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
            y1="50"
            x2="96"
            y2="34"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#14532D" />
            <stop offset="1" stopColor="#4ADE80" />
          </linearGradient>
          <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d="M4 68 C24 88 42 54 60 74 C78 94 90 62 96 72"
          stroke="#86EFAC"
          strokeOpacity="0.24"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <path
          d="M4 62 C22 46 38 74 55 58 C72 42 84 68 96 56"
          stroke="#166534"
          strokeOpacity="0.32"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
        <path
          d="M4 44 C20 60 35 30 50 48 C65 66 80 38 96 52"
          stroke="#16A34A"
          strokeOpacity="0.42"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <path
          d="M4 50 C25 38 45 30 60 32 C75 34 88 44 96 42"
          stroke={`url(#${heroGrad})`}
          strokeWidth="2.2"
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
