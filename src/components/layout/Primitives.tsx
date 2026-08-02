import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-semibold text-foreground">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  delta,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  delta?: number;
  hint?: string;
  tone?: "default" | "mint";
}) {
  return (
    <div className={cn("p-6", tone === "mint" ? "mint-card" : "surface-card")}>
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-3 text-[28px] font-semibold leading-none tracking-tight text-foreground">{value}</p>
      <div className="mt-3 flex items-center gap-2 text-xs">
        {delta !== undefined && (
          <span className={cn("font-semibold", delta >= 0 ? "text-success" : "text-destructive")}>
            {delta >= 0 ? "+" : ""}
            {delta}%
          </span>
        )}
        {hint && <span className="text-subtle">{hint}</span>}
      </div>
    </div>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("surface-card", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
          <div>
            {title && <h4 className="font-semibold text-foreground">{title}</h4>}
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className="p-6">{children}</div>
    </section>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "danger" | "warning" | "info";
}) {
  const tones = {
    neutral: "bg-muted text-muted-foreground",
    success: "bg-mint text-mint-foreground",
    danger: "bg-destructive/10 text-destructive",
    warning: "bg-warning/15 text-warning-foreground",
    info: "bg-primary/10 text-primary",
  } as const;
  return (
    <span className={cn("inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-semibold", tones[tone])}>
      {children}
    </span>
  );
}
