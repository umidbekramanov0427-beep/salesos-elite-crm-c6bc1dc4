import { useI18n } from "@/lib/i18n";

export type AmountRangeValue = { min: number | null; max: number | null };

export const EMPTY_AMOUNT_RANGE: AmountRangeValue = { min: null, max: null };

export function amountInRange(value: number, range: AmountRangeValue): boolean {
  if (range.min != null && value < range.min) return false;
  if (range.max != null && value > range.max) return false;
  return true;
}

// Two side-by-side number inputs — leave one blank for an open-ended range
// (e.g. only "min" set means "this amount and above"), fill both for a
// closed range, or fill just one field with the same number twist for an
// exact-amount match.
export function AmountRangeFilter({
  value,
  onChange,
}: {
  value: AmountRangeValue;
  onChange: (v: AmountRangeValue) => void;
}) {
  const { t } = useI18n();

  function parse(raw: string): number | null {
    if (raw.trim() === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        inputMode="decimal"
        value={value.min ?? ""}
        onChange={(e) => onChange({ ...value, min: parse(e.target.value) })}
        placeholder={t("amountFilter.min")}
        className="h-10 w-28 rounded-2xl border border-border bg-background px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      />
      <span className="text-xs text-subtle">{t("amountFilter.to")}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value.max ?? ""}
        onChange={(e) => onChange({ ...value, max: parse(e.target.value) })}
        placeholder={t("amountFilter.max")}
        className="h-10 w-28 rounded-2xl border border-border bg-background px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      />
    </div>
  );
}
