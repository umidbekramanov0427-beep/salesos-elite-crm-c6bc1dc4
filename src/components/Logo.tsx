import { useId } from "react";

// SalesOS Elite brand mark: two flowing lines that cross once, tracing
// a single continuous arc that flicks upward at the end — a dark
// green front line (deal in motion) over a lighter green line
// underneath it. Sized for compact use (sidebar header, favicons,
// mobile header). BrandMark.tsx renders the same mark larger with the
// wordmark underneath.
export function Logo({ className }: { className?: string }) {
  const heroGrad = useId();

  return (
    <svg viewBox="0 0 100 56" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={heroGrad} x1="4" y1="50" x2="98" y2="3" gradientUnits="userSpaceOnUse">
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
  );
}
