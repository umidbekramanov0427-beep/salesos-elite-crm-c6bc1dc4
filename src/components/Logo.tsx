import { useId } from "react";

// SalesOS Elite brand mark: three flowing wave lines crossing each
// other — one bright emerald/teal "hero" line (the deal that's moving)
// with a soft glow, plus two fainter muted lines behind it (the rest of
// the pipeline) — echoing the login screen's own wave graphic. Sized
// for compact use (sidebar header, favicons, mobile header).
// BrandMark.tsx renders the same mark larger with the wordmark
// underneath.
export function Logo({ className }: { className?: string }) {
  const heroGrad = useId();
  const glowId = useId();

  return (
    <svg viewBox="0 0 100 100" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={heroGrad} x1="4" y1="60" x2="96" y2="35" gradientUnits="userSpaceOnUse">
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
  );
}
