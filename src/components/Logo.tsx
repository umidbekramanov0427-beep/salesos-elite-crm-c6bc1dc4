import { useId } from "react";

// SalesOS Elite brand mark: two crossing, ascending data lines — the same
// motif as the full BrandMark used on the login screen, simplified so it
// still reads clearly at compact sizes (sidebar header, favicons). Blue
// and green are the product's own primary/success colors; the crossing
// point reads as two signals converging into one confident, rising result.
export function Logo({ className }: { className?: string }) {
  const blueId = useId();
  const greenId = useId();

  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={blueId} x1="3" y1="19" x2="21" y2="5" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#60A5FA" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
        <linearGradient id={greenId} x1="3" y1="10" x2="21" y2="9" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#16A34A" />
          <stop offset="1" stopColor="#22C55E" />
        </linearGradient>
      </defs>

      <path
        d="M3 19 L11 13 L21 5"
        stroke={`url(#${blueId})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 10 L11 16 L21 9"
        stroke={`url(#${greenId})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <circle cx="11" cy="13" r="1.5" fill="#2563EB" />
      <circle cx="11" cy="16" r="1.5" fill="#22C55E" />

      <path
        d="M18 4.3 L21 5 L20.3 8"
        stroke="#2563EB"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M18.3 9.7 L21 9 L20.6 11.7"
        stroke="#22C55E"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
