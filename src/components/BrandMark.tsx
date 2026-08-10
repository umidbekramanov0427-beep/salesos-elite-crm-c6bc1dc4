import { useId } from "react";
import { cn } from "@/lib/utils";

// Full splash lockup for decorative/marketing placements (the login
// screen's branding panel): a six-petal pinwheel mark in a green
// gradient, plus the "SalesOS Elite CRM" wordmark on one line beneath
// it. One petal + one accent dot are drawn once and rotated five times
// (60° apart) to get the exact six-fold symmetry. The small in-app icon
// used everywhere else (sidebar, compact headers) stays the simpler mark
// in Logo.tsx — this version is only meant for a larger, decorative size.
export function BrandMark({
  className,
  iconClassName,
  wordmarkClassName,
}: {
  className?: string;
  iconClassName?: string;
  wordmarkClassName?: string;
}) {
  const petalGrad = useId();
  const petalId = useId();
  const dotId = useId();
  const angles = [0, 60, 120, 180, 240, 300];

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
