import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// The shared pill shape every filter on the platform now uses: a leading
// icon naming what the filter is (not just its current value), the native
// <select>'s own selected-option text, and a trailing chevron -- all inside
// one fully-rounded control instead of a bare rectangular <select>.
export function FilterSelect({
  icon: Icon,
  value,
  onChange,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-border bg-background pl-3.5 pr-3 transition-colors focus-within:ring-2 focus-within:ring-primary/40 hover:bg-accent",
        className,
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none bg-transparent text-sm font-medium text-foreground outline-none"
      >
        {children}
      </select>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </div>
  );
}

// The matching pill-shaped search input, so a text filter sits visually
// consistent next to FilterSelect pills instead of the old plain rectangle.
export function FilterSearchInput({
  icon: Icon,
  value,
  onChange,
  placeholder,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-border bg-background pl-3.5 pr-4 transition-colors focus-within:ring-2 focus-within:ring-primary/40",
        className,
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-subtle placeholder:font-normal"
      />
    </div>
  );
}
