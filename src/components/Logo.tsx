import { useId } from "react";

// SalesOS Elite brand mark: a single flowing wave line (the "smooth flow"
// of a pipeline moving forward) with two fainter trailing ripples behind
// it and a bright dot at the leading edge — same emerald ramp as the
// login screen's wave graphic. Sized for compact use (sidebar header,
// favicons, mobile header). BrandMark.tsx renders the same mark at a
// larger size with the wordmark underneath.
export function Logo({ className }: { className?: string }) {
  const waveGrad = useId();

  return (
    <svg viewBox="0 0 100 100" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={waveGrad} x1="8" y1="60" x2="90" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#14532D" />
          <stop offset="0.55" stopColor="#16A34A" />
          <stop offset="1" stopColor="#4ADE80" />
        </linearGradient>
      </defs>
      <path
        d="M4 50 C16 22 32 22 42 44 C52 66 68 66 80 36"
        stroke="#16A34A"
        strokeOpacity="0.18"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M8 54 C20 26 36 26 46 48 C56 70 72 70 84 40"
        stroke="#16A34A"
        strokeOpacity="0.35"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M12 58 C24 30 40 30 50 52 C60 74 76 74 88 44"
        stroke={`url(#${waveGrad})`}
        strokeWidth="9"
        strokeLinecap="round"
      />
      <circle cx="88" cy="44" r="4.5" fill="#86EFAC" />
    </svg>
  );
}
