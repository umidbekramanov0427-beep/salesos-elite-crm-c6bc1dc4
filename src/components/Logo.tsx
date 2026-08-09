// SalesOS Elite brand mark: three ascending bars, reading as a growth
// chart. Renders in currentColor so it inherits whatever badge/button
// color it's placed in (matches how the old Sparkles icon was used).
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="13" width="4" height="8" rx="1.4" fill="currentColor" opacity="0.5" />
      <rect x="10" y="8.5" width="4" height="12.5" rx="1.4" fill="currentColor" opacity="0.75" />
      <rect x="17" y="3" width="4" height="18" rx="1.4" fill="currentColor" />
    </svg>
  );
}
