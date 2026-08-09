import { useId } from "react";
import { cn } from "@/lib/utils";

// Full splash lockup for decorative/marketing placements (the login
// screen's dark branding panel). A circular data-flow ring in a
// blue-to-teal gradient with three upward arrows orbiting it — reading as
// data continuously flowing up and around, i.e. growth. Minimal and sleek
// by design: no crowded detail, just the ring, the arrows and the
// wordmark. The small in-app icon used everywhere else (sidebar, compact
// headers) stays the simpler four-point mark in Logo.tsx — this version
// is intentionally more detailed and only meant for a dark background.
export function BrandMark({
  className,
  iconClassName,
}: {
  className?: string;
  iconClassName?: string;
}) {
  const flowGrad = useId();

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <svg
        viewBox="0 0 64 64"
        fill="none"
        className={cn("h-16 w-16", iconClassName)}
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id={flowGrad}
            x1="6"
            y1="58"
            x2="58"
            y2="6"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#3B82F6" />
            <stop offset="1" stopColor="#2DD4BF" />
          </linearGradient>
        </defs>

        <circle cx="32" cy="32" r="21" stroke={`url(#${flowGrad})`} strokeWidth="2.5" />

        <path
          d="M25.5 21 L32 12.5 L38.5 21"
          stroke={`url(#${flowGrad})`}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          transform="rotate(-20 32 32)"
        />
        <path
          d="M25.5 21 L32 12.5 L38.5 21"
          stroke={`url(#${flowGrad})`}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          transform="rotate(100 32 32)"
        />
        <path
          d="M25.5 21 L32 12.5 L38.5 21"
          stroke={`url(#${flowGrad})`}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          transform="rotate(220 32 32)"
        />

        <circle cx="32" cy="32" r="3.5" fill={`url(#${flowGrad})`} />
      </svg>

      <div className="text-center leading-tight">
        <p className="text-2xl font-bold tracking-tight text-white">
          SALES<span className="text-teal-400">OS</span>
        </p>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/60">
          Elite CRM
        </p>
      </div>
    </div>
  );
}
