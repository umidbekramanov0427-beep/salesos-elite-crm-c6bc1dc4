import { useId } from "react";
import { cn } from "@/lib/utils";

// Full splash lockup for decorative/marketing placements (the login
// screen's branding panel): the same flowing-wave mark as Logo.tsx —
// one bright wave with two fainter trailing ripples behind it, ending
// in a leading dot — plus the "SalesOS Elite CRM" wordmark on one line
// beneath it. The wave echoes the login screen's own animated wave
// graphic. The small in-app icon used everywhere else (sidebar, compact
// headers) stays Logo.tsx — this version is only meant for a larger,
// decorative size.
export function BrandMark({
  className,
  iconClassName,
  wordmarkClassName,
}: {
  className?: string;
  iconClassName?: string;
  wordmarkClassName?: string;
}) {
  const waveGrad = useId();

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
            id={waveGrad}
            x1="8"
            y1="60"
            x2="90"
            y2="36"
            gradientUnits="userSpaceOnUse"
          >
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
