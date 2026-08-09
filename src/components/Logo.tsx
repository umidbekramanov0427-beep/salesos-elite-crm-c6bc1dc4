import { useId } from "react";

// SalesOS Elite brand mark: an ascending, four-point data line — a growth
// trajectory. The first point is soft, pale, and blurred (raw, ambiguous
// signal); each following point sharpens and brightens as the line climbs,
// resolving into a solid, saturated point at the peak (clear, measured
// result). The gradient runs from the product's primary blue (system,
// analytics) into its success green (momentum, results), so the mark tells
// the same story as the product: from noisy data to a confident outcome.
export function Logo({ className }: { className?: string }) {
  const gradientId = useId();
  const blurId = useId();

  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient
          id={gradientId}
          x1="3.5"
          y1="19"
          x2="20"
          y2="4"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#2563EB" />
          <stop offset="1" stopColor="#22C55E" />
        </linearGradient>
        <filter id={blurId} x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="1" />
        </filter>
      </defs>
      <path
        d="M3.5 18.5 L9.5 14 L15 9.5 L20 4"
        stroke={`url(#${gradientId})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="3.5" cy="18.5" r="2.4" fill="#2563EB" opacity="0.32" filter={`url(#${blurId})`} />
      <circle cx="9.5" cy="14" r="1.5" fill="#3B82F6" />
      <circle cx="15" cy="9.5" r="1.6" fill="#16A34A" />
      <circle cx="20" cy="4" r="2.15" fill="#22C55E" />
    </svg>
  );
}
