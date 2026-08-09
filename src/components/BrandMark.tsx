import { useId } from "react";
import { cn } from "@/lib/utils";

// Full splash lockup for decorative/marketing placements (the login
// screen's branding panel). A two-tone ring with a pair of crossing,
// ascending data lines inside it, plus the wordmark. The small in-app
// icon used everywhere else (sidebar, compact headers) stays the simpler
// four-point mark in Logo.tsx — this version is intentionally more
// detailed and only meant to be shown at a larger size.
export function BrandMark({
  className,
  iconClassName,
}: {
  className?: string;
  iconClassName?: string;
}) {
  const ringBlue = useId();
  const ringGreen = useId();
  const lineBlue = useId();
  const lineGreen = useId();

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <svg
        viewBox="0 0 64 64"
        fill="none"
        className={cn("h-16 w-16", iconClassName)}
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id={ringBlue}
            x1="8"
            y1="8"
            x2="32"
            y2="32"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#60A5FA" />
            <stop offset="1" stopColor="#2563EB" />
          </linearGradient>
          <linearGradient
            id={ringGreen}
            x1="32"
            y1="32"
            x2="56"
            y2="56"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#22C55E" />
            <stop offset="1" stopColor="#4ADE80" />
          </linearGradient>
          <linearGradient
            id={lineBlue}
            x1="14"
            y1="42"
            x2="46"
            y2="16"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#3B82F6" />
            <stop offset="1" stopColor="#2563EB" />
          </linearGradient>
          <linearGradient
            id={lineGreen}
            x1="14"
            y1="30"
            x2="46"
            y2="26"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#16A34A" />
            <stop offset="1" stopColor="#22C55E" />
          </linearGradient>
        </defs>

        <circle
          cx="32"
          cy="32"
          r="26"
          stroke={`url(#${ringBlue})`}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="63 100"
          transform="rotate(-125 32 32)"
        />
        <circle
          cx="32"
          cy="32"
          r="26"
          stroke={`url(#${ringGreen})`}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="63 100"
          transform="rotate(55 32 32)"
        />

        <path
          d="M14 40 L24 32 L34 36 L46 16"
          stroke={`url(#${lineBlue})`}
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14 30 L24 38 L34 20 L46 26"
          stroke={`url(#${lineGreen})`}
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <circle cx="14" cy="40" r="1.6" fill="#2563EB" />
        <circle cx="24" cy="32" r="1.6" fill="#2563EB" />
        <circle cx="34" cy="36" r="1.6" fill="#2563EB" />
        <path
          d="M43 12 L46 16 L42 17.5"
          stroke="#2563EB"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        <circle cx="14" cy="30" r="1.6" fill="#22C55E" />
        <circle cx="24" cy="38" r="1.6" fill="#22C55E" />
        <circle cx="34" cy="20" r="1.6" fill="#22C55E" />
        <path
          d="M42 22 L46 26 L41 26.5"
          stroke="#22C55E"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>

      <div className="text-center leading-tight">
        <p className="text-xl font-bold tracking-tight text-foreground">
          Sales<span className="text-primary">OS</span>
        </p>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Elite CRM
        </p>
      </div>
    </div>
  );
}
