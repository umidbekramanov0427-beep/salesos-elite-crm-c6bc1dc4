import { useState } from "react";
import { ChevronDown, CirclePlus, Pencil, Trash2 } from "lucide-react";
import { Pill } from "@/components/layout/Primitives";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import type { AuditEntryView } from "@/hooks/use-crm-data";

function formatFieldValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function ActionIcon({ action }: { action: string }) {
  if (action === "insert") return <CirclePlus className="h-4 w-4 text-success" />;
  if (action === "delete") return <Trash2 className="h-4 w-4 text-destructive" />;
  return <Pencil className="h-4 w-4 text-primary" />;
}

function EntryRow({
  entry,
  hideEntityLabel,
}: {
  entry: AuditEntryView;
  hideEntityLabel?: boolean | undefined;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const hasDiff = entry.changedFields.length > 0;

  return (
    <li className="rounded-xl border border-border bg-surface px-4 py-3">
      <button
        type="button"
        onClick={() => hasDiff && setOpen((o) => !o)}
        className={cn("flex w-full items-start gap-3 text-left", !hasDiff && "cursor-default")}
      >
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-background">
          <ActionIcon action={entry.action} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-foreground">{entry.actorName}</span>
            <Pill tone={entry.action === "delete" ? "danger" : "info"}>
              {t(`history.action.${entry.action}`)}
            </Pill>
            {!hideEntityLabel && (
              <span className="text-muted-foreground">
                {t(`history.entity.${entry.entityType}`)}
              </span>
            )}
          </p>
          <p className="mt-1 text-xs text-subtle">{entry.when}</p>
          {hasDiff && !open && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {t("history.fieldsChanged", { count: entry.changedFields.length })}
            </p>
          )}
        </div>
        {hasDiff && (
          <ChevronDown
            className={cn(
              "mt-1 h-4 w-4 shrink-0 text-subtle transition-transform",
              open && "rotate-180",
            )}
          />
        )}
      </button>

      {open && hasDiff && (
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[420px] text-xs">
            <thead>
              <tr className="border-b border-border bg-background text-left text-[11px] uppercase tracking-wide text-subtle">
                <th className="px-3 py-2">{t("history.field")}</th>
                <th className="px-3 py-2">{t("history.before")}</th>
                <th className="px-3 py-2">{t("history.after")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entry.changedFields.map((f) => (
                <tr key={f}>
                  <td className="px-3 py-2 font-medium text-foreground">{f}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {formatFieldValue(entry.before?.[f])}
                  </td>
                  <td className="px-3 py-2 text-success">{formatFieldValue(entry.after?.[f])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </li>
  );
}

export function AuditTrailList({
  entries,
  hideEntityLabel,
  emptyLabel,
}: {
  entries: AuditEntryView[];
  hideEntityLabel?: boolean | undefined;
  emptyLabel: string;
}) {
  if (entries.length === 0) {
    return <p className="py-6 text-center text-sm text-subtle">{emptyLabel}</p>;
  }
  return (
    <ul className="space-y-2">
      {entries.map((entry) => (
        <EntryRow key={entry.id} entry={entry} hideEntityLabel={hideEntityLabel} />
      ))}
    </ul>
  );
}
