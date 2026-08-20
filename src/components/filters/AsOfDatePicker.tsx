import { useState } from "react";
import { CalendarClock, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// A single past date, not a range — picking one switches the page from live
// data to a reconstructed snapshot of exactly how things stood at the end
// of that day (see useAsOfSnapshot / entities_as_of()).
export function AsOfDatePicker({
  value,
  onChange,
}: {
  value: Date | null;
  onChange: (v: Date | null) => void;
}) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-14 w-64 shrink-0 items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-left outline-none transition-colors",
            value
              ? "border-warning/40 bg-warning/10 text-warning-foreground"
              : "border-border bg-surface text-foreground hover:bg-accent",
          )}
        >
          <CalendarClock className="h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">
              {t("asOf.label")}
            </p>
            <p className="truncate text-sm font-bold">
              {value ? value.toLocaleDateString(lang) : t("asOf.live")}
            </p>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3">
        <Calendar
          mode="single"
          selected={value ?? undefined}
          onSelect={(d) => {
            onChange(d ?? null);
            setOpen(false);
          }}
          disabled={{ after: new Date() }}
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className="mt-2 w-full rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent"
          >
            {t("asOf.backToLive")}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function AsOfBanner({ value }: { value: Date | null }) {
  const { t, lang } = useI18n();
  if (!value) return null;
  return (
    <div className="mb-4 flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm text-warning-foreground">
      <CalendarClock className="h-4 w-4 shrink-0" />
      {t("asOf.viewingBanner", { date: value.toLocaleDateString(lang) })}
    </div>
  );
}
