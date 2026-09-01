import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AlignLeft,
  Building2,
  ExternalLink,
  File as FileIcon,
  FileText,
  GraduationCap,
  Image as ImageIcon,
  Link2,
  Loader2,
  Music2,
  Plus,
  Trash2,
  Video as VideoIcon,
} from "lucide-react";
import { PageHeader, SectionCard } from "@/components/layout/Primitives";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useContentLibraryItems,
  useContentLibrarySettings,
  useCreateContentLibraryItem,
  useDeleteContentLibraryItem,
  useUpdateContentLibrarySettings,
  useUploadContentLibraryFile,
  type ContentLibraryItemType,
  type ContentLibrarySection,
} from "@/hooks/use-crm-data";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Supabase's PostgrestError is a plain object, not an Error instance, so
// `err instanceof Error ? err.message : fallback` always fell through to the
// generic fallback for a real DB error (e.g. a constraint violation) --
// masking exactly the detail someone would need to diagnose it.
function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
    return err.message || fallback;
  }
  return fallback;
}

export const Route = createFileRoute("/content-library")({
  head: () => ({
    meta: [
      { title: "Hujjat va Darsliklar — SalesOS Elite" },
      {
        name: "description",
        content: "Kompaniya haqida ma'lumot, hujjatlar va sotuv/marketing darsliklari.",
      },
    ],
  }),
  component: ContentLibraryPage,
});

const ITEM_TYPE_ICON: Record<ContentLibraryItemType, typeof Link2> = {
  link: Link2,
  document: FileText,
  image: ImageIcon,
  video: VideoIcon,
  audio: Music2,
  file: FileIcon,
  text: AlignLeft,
};

const TYPE_OPTIONS: { value: ContentLibraryItemType; labelKey: string }[] = [
  { value: "text", labelKey: "contentLibrary.typeText" },
  { value: "link", labelKey: "contentLibrary.typeLink" },
  { value: "document", labelKey: "contentLibrary.typeDocument" },
  { value: "image", labelKey: "contentLibrary.typeImage" },
  { value: "video", labelKey: "contentLibrary.typeVideo" },
  { value: "audio", labelKey: "contentLibrary.typeAudio" },
  { value: "file", labelKey: "contentLibrary.typeFile" },
];

function AddItemDialog({
  open,
  onOpenChange,
  section,
  dialogTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: ContentLibrarySection;
  dialogTitle: string;
}) {
  const { t } = useI18n();
  const createItem = useCreateContentLibraryItem();
  const uploadFile = useUploadContentLibraryFile();
  const [itemTitle, setItemTitle] = useState("");
  const [description, setDescription] = useState("");
  const [itemType, setItemType] = useState<ContentLibraryItemType>("link");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setItemTitle("");
    setDescription("");
    setItemType("link");
    setUrl("");
    setFile(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!itemTitle.trim()) return;
    setSaving(true);
    try {
      let finalUrl: string | null = url.trim();
      let filePath: string | null = null;
      if (itemType === "text") {
        if (!description.trim()) {
          toast.error(t("contentLibrary.noTextEntered"));
          setSaving(false);
          return;
        }
        finalUrl = null;
      } else {
        if (itemType !== "link") {
          if (!file) {
            toast.error(t("contentLibrary.noFileSelected"));
            setSaving(false);
            return;
          }
          const uploaded = await uploadFile.mutateAsync(file);
          finalUrl = uploaded.url;
          filePath = uploaded.path;
        }
        if (!finalUrl) {
          toast.error(t("contentLibrary.noUrlOrFile"));
          setSaving(false);
          return;
        }
      }
      await createItem.mutateAsync({
        section,
        title: itemTitle,
        description,
        itemType,
        url: finalUrl,
        filePath,
      });
      toast.success(t("contentLibrary.added"));
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, t("contentLibrary.addFailed")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-muted-foreground">
              {t("contentLibrary.fieldTitle")}
            </span>
            <input
              value={itemTitle}
              onChange={(e) => setItemTitle(e.target.value)}
              required
              className="mt-1.5 h-11 w-full rounded-xl border border-border bg-accent px-3 text-sm outline-none focus:border-primary/40"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-muted-foreground">
              {itemType === "text"
                ? t("contentLibrary.fieldText")
                : t("contentLibrary.fieldDescription")}
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required={itemType === "text"}
              rows={itemType === "text" ? 10 : 6}
              className="mt-1.5 w-full rounded-xl border border-border bg-accent px-3 py-2 text-sm outline-none focus:border-primary/40"
            />
          </label>

          <div>
            <span className="text-sm font-medium text-muted-foreground">
              {t("contentLibrary.fieldType")}
            </span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setItemType(opt.value)}
                  className={cn(
                    "rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors",
                    itemType === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted-foreground hover:bg-accent",
                  )}
                >
                  {t(opt.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {itemType === "text" ? null : itemType === "link" ? (
            <label className="block">
              <span className="text-sm font-medium text-muted-foreground">
                {t("contentLibrary.fieldUrl")}
              </span>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="mt-1.5 h-11 w-full rounded-xl border border-border bg-accent px-3 text-sm outline-none focus:border-primary/40"
              />
            </label>
          ) : (
            <label className="block">
              <span className="text-sm font-medium text-muted-foreground">
                {t("contentLibrary.fieldFile")}
              </span>
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-1.5 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-semibold file:text-foreground"
              />
            </label>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("contentLibrary.add")}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ItemsShelf({
  section,
  title,
  description,
  canEdit,
}: {
  section: ContentLibrarySection;
  title: string;
  description: string;
  canEdit: boolean;
}) {
  const { t } = useI18n();
  const { data: items, isLoading } = useContentLibraryItems(section);
  const deleteItem = useDeleteContentLibraryItem();
  const [addOpen, setAddOpen] = useState(false);

  async function remove(id: string) {
    try {
      await deleteItem.mutateAsync(id);
      toast.success(t("contentLibrary.deleted"));
    } catch (err) {
      toast.error(errorMessage(err, t("contentLibrary.deleteFailed")));
    }
  }

  return (
    <SectionCard
      title={title}
      description={description}
      actions={
        canEdit ? (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-1.5 text-xs font-semibold text-subtle transition-colors hover:border-primary/40 hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("contentLibrary.add")}
          </button>
        ) : undefined
      }
    >
      {isLoading ? (
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-subtle" />
      ) : (items ?? []).length === 0 ? (
        <p className="py-6 text-center text-sm text-subtle">{t("contentLibrary.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {(items ?? []).map((item) => {
            const Icon = ITEM_TYPE_ICON[item.item_type as ContentLibraryItemType] ?? FileIcon;
            const isImage = item.item_type === "image";
            const isText = item.item_type === "text";
            const Wrapper = isText ? "div" : "a";
            const body = (
              <>
                {isImage ? (
                  <img
                    src={item.url ?? undefined}
                    alt={item.title}
                    className="h-16 w-16 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {item.title}
                  </span>
                  {item.description && (
                    <span
                      className={cn(
                        "mt-0.5 block whitespace-pre-wrap break-words text-xs",
                        isText ? "text-foreground" : "text-subtle",
                      )}
                    >
                      {item.description}
                    </span>
                  )}
                </span>
              </>
            );
            return (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
              >
                <Wrapper
                  {...(isText
                    ? {}
                    : {
                        href: item.url ?? undefined,
                        target: "_blank",
                        rel: "noopener noreferrer",
                      })}
                  className="flex min-w-0 flex-1 items-start gap-3"
                >
                  {body}
                </Wrapper>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => void remove(item.id)}
                    className="shrink-0 rounded-lg p-1.5 text-subtle transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label={t("contentLibrary.deleted")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <AddItemDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        section={section}
        dialogTitle={title}
      />
    </SectionCard>
  );
}

function GoogleSheetsCard({
  canEdit,
  urlValue,
  onSave,
  label,
}: {
  canEdit: boolean;
  urlValue: string;
  onSave: (url: string) => Promise<void>;
  label: string;
}) {
  const { t } = useI18n();
  const [url, setUrl] = useState(urlValue);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (hydrated) return;
    setUrl(urlValue);
    setHydrated(true);
  }, [urlValue, hydrated]);

  async function save() {
    setSaving(true);
    try {
      await onSave(url.trim());
      toast.success(t("contentLibrary.saved"));
    } catch (err) {
      toast.error(errorMessage(err, t("contentLibrary.saveFailed")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard title={label} description={t("contentLibrary.sheetsDesc")}>
      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className="h-11 min-w-[240px] flex-1 rounded-xl border border-border bg-accent px-3 text-sm outline-none focus:border-primary/40"
          />
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("common.save")}
          </button>
        </div>
      ) : urlValue ? (
        <a
          href={urlValue}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-accent"
        >
          <ExternalLink className="h-4 w-4" />
          {t("contentLibrary.openSheet")}
        </a>
      ) : (
        <p className="text-sm text-subtle">{t("contentLibrary.noSheetYet")}</p>
      )}
    </SectionCard>
  );
}

function ContentLibraryPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const canEdit = user?.role === "super_admin";
  const [tab, setTab] = useState<"about" | "training">("about");
  const { data: settings } = useContentLibrarySettings();
  const updateSettings = useUpdateContentLibrarySettings();

  return (
    <>
      <PageHeader title={t("contentLibrary.title")} description={t("contentLibrary.desc")} />

      <div className="mb-6 inline-flex flex-wrap items-center gap-1 rounded-2xl border border-border bg-card p-1.5 shadow-soft">
        <button
          type="button"
          onClick={() => setTab("about")}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors",
            tab === "about"
              ? "bg-primary/10 text-primary ring-1 ring-primary/50"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          <Building2 className="h-4 w-4" />
          {t("contentLibrary.tabAbout")}
        </button>
        <button
          type="button"
          onClick={() => setTab("training")}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors",
            tab === "training"
              ? "bg-primary/10 text-primary ring-1 ring-primary/50"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          <GraduationCap className="h-4 w-4" />
          {t("contentLibrary.tabTraining")}
        </button>
      </div>

      {tab === "about" ? (
        <div className="space-y-6">
          <GoogleSheetsCard
            canEdit={canEdit}
            urlValue={settings?.about_google_sheets_url ?? ""}
            onSave={(url) => updateSettings.mutateAsync({ aboutGoogleSheetsUrl: url })}
            label={t("contentLibrary.aboutSheetsLabel")}
          />
          <ItemsShelf
            section="about_general"
            title={t("contentLibrary.generalTitle")}
            description={t("contentLibrary.generalDesc")}
            canEdit={canEdit}
          />
          <ItemsShelf
            section="about_org_structure"
            title={t("contentLibrary.orgStructureTitle")}
            description={t("contentLibrary.orgStructureDesc")}
            canEdit={canEdit}
          />
          <ItemsShelf
            section="about_regulation"
            title={t("contentLibrary.regulationTitle")}
            description={t("contentLibrary.regulationDesc")}
            canEdit={canEdit}
          />
        </div>
      ) : (
        <div className="space-y-6">
          <GoogleSheetsCard
            canEdit={canEdit}
            urlValue={settings?.training_google_sheets_url ?? ""}
            onSave={(url) => updateSettings.mutateAsync({ trainingGoogleSheetsUrl: url })}
            label={t("contentLibrary.trainingSheetsLabel")}
          />
          <ItemsShelf
            section="training"
            title={t("contentLibrary.trainingTitle")}
            description={t("contentLibrary.trainingDesc")}
            canEdit={canEdit}
          />
        </div>
      )}
    </>
  );
}
