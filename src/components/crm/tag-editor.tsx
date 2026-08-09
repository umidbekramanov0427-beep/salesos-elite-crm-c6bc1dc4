import { useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useUpdateLead } from "@/hooks/use-crm-data";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const TAG_TONES = [
  "bg-mint text-mint-foreground border-mint-border",
  "bg-primary/10 text-primary border-primary/20",
  "bg-warning/15 text-warning-foreground border-warning/25",
  "bg-success/10 text-success border-success/20",
  "bg-accent text-accent-foreground border-border",
] as const;

function tagTone(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_TONES[hash % TAG_TONES.length];
}

export function TagChip({ tag, size = "sm" }: { tag: string; size?: "sm" | "xs" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg border font-semibold",
        size === "sm" ? "px-2 py-1 text-[11px]" : "px-1.5 py-0.5 text-[10px]",
        tagTone(tag),
      )}
    >
      {tag}
    </span>
  );
}

export function TagEditor({
  leadId,
  tags,
  editable = true,
  emptyLabel,
}: {
  leadId: string;
  tags: string[];
  editable?: boolean;
  emptyLabel?: string;
}) {
  const { t } = useI18n();
  const updateLead = useUpdateLead();
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);

  async function save(next: string[]) {
    try {
      await updateLead.mutateAsync({ id: leadId, patch: { tags: next } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("tags.updateFailed"));
    }
  }

  function addTag() {
    const value = draft.trim();
    if (!value) return;
    if (!tags.includes(value)) void save([...tags, value]);
    setDraft("");
    setOpen(false);
  }

  function removeTag(tag: string) {
    void save(tags.filter((t) => t !== tag));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Escape") {
      setDraft("");
      setOpen(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.length === 0 && !editable && (
        <p className="text-sm text-subtle">{emptyLabel ?? t("tags.noTags")}</p>
      )}
      {tags.map((tag) =>
        editable ? (
          <span
            key={tag}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold",
              tagTone(tag),
            )}
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="rounded-full p-0.5 opacity-70 hover:bg-background/40 hover:opacity-100"
              aria-label={t("tags.remove", { tag })}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ) : (
          <TagChip key={tag} tag={tag} />
        ),
      )}
      {editable && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              <Plus className="h-3 w-3" /> {t("tags.addTag")}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-56 p-2"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={t("tags.newTagPlaceholder")}
              className="h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm outline-none focus:border-primary/40"
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
