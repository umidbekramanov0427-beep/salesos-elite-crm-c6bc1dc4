import { useState } from "react";
import { LayoutGrid, List, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import type { CrmLeadView, ProfileRow, StageRow } from "@/hooks/use-crm-data";
import {
  AmountRangeFilter,
  amountInRange,
  type AmountRangeValue,
} from "@/components/filters/AmountRangeFilter";

export type LeadFilterState = {
  funnel: string | null;
  ownerId: string | null;
  tags: string[];
  stageId: string | null;
  search: string;
  amount: AmountRangeValue;
};

export const EMPTY_LEAD_FILTERS: LeadFilterState = {
  funnel: null,
  ownerId: null,
  tags: [],
  stageId: null,
  search: "",
  amount: { min: null, max: null },
};

export function filterLeads(leads: CrmLeadView[], f: LeadFilterState): CrmLeadView[] {
  const q = f.search.trim().toLowerCase();
  return leads.filter((l) => {
    if (f.funnel && (l.funnel || "Direct Sales") !== f.funnel) return false;
    if (f.ownerId && l.ownerId !== f.ownerId) return false;
    if (f.stageId && l.stageId !== f.stageId) return false;
    if (f.tags.length > 0 && !f.tags.some((tag) => l.tags.includes(tag))) return false;
    if (!amountInRange(l.expectedRevenue, f.amount)) return false;
    if (q) {
      const haystack = `${l.name} ${l.company} ${l.phone} ${l.id} ${l.score}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

function TagMultiSelect({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  function toggle(tag: string) {
    onChange(selected.includes(tag) ? selected.filter((x) => x !== tag) : [...selected, tag]);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors hover:border-primary/40"
      >
        {t("leadFilter.allTags")}
        {selected.length > 0 && (
          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
            {selected.length}
          </span>
        )}
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default"
            aria-label={t("common.close")}
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full z-20 mt-2 max-h-64 w-56 space-y-1 overflow-y-auto rounded-xl border border-border bg-popover p-2 shadow-card">
            {options.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-subtle">{t("common.none")}</p>
            )}
            {options.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggle(tag)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                  selected.includes(tag) && "bg-primary/10 text-primary",
                )}
              >
                <span className="truncate">{tag}</span>
                {selected.includes(tag) && <span>✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function LeadFilterBar({
  value,
  onChange,
  funnels,
  owners,
  tags,
  stages,
  view,
  onViewChange,
}: {
  value: LeadFilterState;
  onChange: (v: LeadFilterState) => void;
  funnels: string[];
  owners: ProfileRow[];
  tags: string[];
  stages: StageRow[];
  view?: "gallery" | "list";
  onViewChange?: (v: "gallery" | "list") => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={value.funnel ?? ""}
        onChange={(e) => onChange({ ...value, funnel: e.target.value || null })}
        className="h-9 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <option value="">{t("leadFilter.allFunnels")}</option>
        {funnels.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>

      <select
        value={value.ownerId ?? ""}
        onChange={(e) => onChange({ ...value, ownerId: e.target.value || null })}
        className="h-9 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <option value="">{t("leadFilter.allOwners")}</option>
        {owners.map((o) => (
          <option key={o.id} value={o.id}>
            {o.full_name || o.email}
          </option>
        ))}
      </select>

      <select
        value={value.stageId ?? ""}
        onChange={(e) => onChange({ ...value, stageId: e.target.value || null })}
        className="h-9 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <option value="">{t("leadFilter.allStages")}</option>
        {stages
          .filter((s) => !value.funnel || (s.pipeline_name || "Direct Sales") === value.funnel)
          .map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
      </select>

      <TagMultiSelect
        options={tags}
        selected={value.tags}
        onChange={(v) => onChange({ ...value, tags: v })}
      />

      <AmountRangeFilter value={value.amount} onChange={(v) => onChange({ ...value, amount: v })} />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
        <input
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
          placeholder={t("leadFilter.searchPlaceholder")}
          className="h-9 w-64 rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none placeholder:text-subtle focus-visible:ring-2 focus-visible:ring-primary/40"
        />
      </div>

      {view && onViewChange && (
        <div className="ml-auto inline-flex items-center gap-1 rounded-xl border border-border p-1">
          <button
            type="button"
            onClick={() => onViewChange("gallery")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
              view === "gallery"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> {t("leadFilter.gallery")}
          </button>
          <button
            type="button"
            onClick={() => onViewChange("list")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
              view === "list"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            <List className="h-3.5 w-3.5" /> {t("leadFilter.list")}
          </button>
        </div>
      )}
    </div>
  );
}
