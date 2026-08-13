import type { ReactNode } from "react";
import { ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { downloadCsv, exportAsPdf } from "@/lib/export-csv";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// Deterministic accent color per card, keyed by label, so every stat tile
// across the platform reads as its own thing at a glance instead of a wall
// of identical gray boxes — without every call site having to pick a color.
const STAT_ACCENTS = [
  "before:bg-blue-500",
  "before:bg-emerald-500",
  "before:bg-amber-500",
  "before:bg-violet-500",
  "before:bg-rose-500",
  "before:bg-cyan-500",
  "before:bg-orange-500",
  "before:bg-teal-500",
] as const;

function statAccent(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  return STAT_ACCENTS[hash % STAT_ACCENTS.length] ?? STAT_ACCENTS[0];
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
    <div
      className={cn(
        "relative overflow-hidden p-6 before:absolute before:inset-y-0 before:left-0 before:w-1.5",
        statAccent(label),
        tone === "mint" ? "mint-card" : "surface-card",
      )}
    >
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-3 text-[28px] font-semibold leading-none tracking-tight text-foreground">
        {value}
      </p>
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
  id,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("surface-card", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
          <div>
            {title && <h2 className="font-semibold text-foreground">{title}</h2>}
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
  tone?: "neutral" | "success" | "danger" | "warning" | "info" | "blue" | "gold";
}) {
  const tones = {
    neutral: "bg-muted text-muted-foreground",
    success: "bg-mint text-mint-foreground",
    danger: "bg-destructive/10 text-destructive",
    warning: "bg-warning/15 text-warning-foreground",
    info: "bg-primary/10 text-primary",
    blue: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    gold: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-semibold",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

// Client-side CSV export for any data table on the platform — opens
// directly in Excel and can be imported into Google Sheets (no API
// connection required, so it works everywhere without extra setup).
export function ExportButton({
  filename,
  rows,
}: {
  filename: string;
  rows: Record<string, unknown>[];
}) {
  const { t } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={rows.length === 0}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> {t("common.export")}
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => downloadCsv(filename, rows)}>
          <FileSpreadsheet className="h-4 w-4" /> {t("common.exportCsv")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportAsPdf(filename, rows)}>
          <FileText className="h-4 w-4" /> {t("common.exportPdf")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
