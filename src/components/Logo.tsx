import { useId } from "react";

// SalesOS Elite brand mark: the same six-petal pinwheel as the login
// screen's BrandMark (one petal drawn once, rotated 60° five times),
// just without the wordmark — sized for compact use (sidebar header,
// favicons, mobile header).
export function Logo({ className }: { className?: string }) {
  const petalGrad = useId();
  const petalId = useId();
  const dotId = useId();
  const angles = [0, 60, 120, 180, 240, 300];

  return (
    <svg viewBox="0 0 100 100" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient
          id={petalGrad}
          x1="50"
          y1="50"
          x2="50"
          y2="12"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#14532D" />
          <stop offset="0.55" stopColor="#16A34A" />
          <stop offset="1" stopColor="#4ADE80" />
        </linearGradient>
        <path
          id={petalId}
          d="M50 50 C45.5 39 43.5 25 50 12 C59 20 63 33 56.5 43.5 C54.5 46.5 52 48.5 50 50 Z"
          fill={`url(#${petalGrad})`}
        />
        <circle id={dotId} cx="50" cy="6.5" r="3.2" fill="#22C55E" />
      </defs>

      {angles.map((a) => (
        <use key={`p-${a}`} href={`#${petalId}`} transform={`rotate(${a} 50 50)`} />
      ))}
      {angles.map((a) => (
        <use key={`d-${a}`} href={`#${dotId}`} transform={`rotate(${a} 50 50)`} />
      ))}
    </svg>
  );
}
