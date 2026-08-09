import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  Award,
  Building2,
  ListChecks,
  Loader2,
  LayoutGrid,
  Moon,
  Pencil,
  Plus,
  SlidersHorizontal,
  Sun,
  Tag as TagIcon,
  Thermometer,
  Trash2,
  TrendingUp,
  Users,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionCard, Pill } from "@/components/layout/Primitives";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useCurrency, CURRENCIES } from "@/lib/currency";
import { useI18n, LANGS, LANG_LABELS } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import {
  useBusinessProfile,
  useCreateStage,
  useCrmLeads,
  useDeleteStage,
  useDeleteTag,
  usePipelineStagesRaw,
  useRenameTag,
  useTagsSummary,
  useUpdateBusinessProfile,
  useUpdateProfile,
  useUpdateStage,
  type StageRow,
} from "@/hooks/use-crm-data";
import { cn } from "@/lib/utils";
import { SegmentedControl } from "@/components/ui/segmented-control";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — SalesOS Elite" },
      { name: "description", content: "Profile, workspace, language and appearance settings." },
      { property: "og:title", content: "Settings — SalesOS Elite" },
      { property: "og:description", content: "Workspace, appearance and preference settings." },
    ],
  }),
  component: SettingsPage,
});

const STAGE_COLORS = [
  "bg-primary",
  "bg-success",
  "bg-warning",
  "bg-destructive",
  "bg-mint-border",
  "bg-muted-foreground",
] as const;

type SectionKey =
  | "profile"
  | "business"
  | "stages"
  | "tags"
  | "users"
  | "categories"
  | "salesStages"
  | "scoreModifiers"
  | "skills"
  | "qualificationGroups"
  | "leadCategories"
  | "conversion";

const COMING_SOON: SectionKey[] = [
  "categories",
  "salesStages",
  "scoreModifiers",
  "skills",
  "qualificationGroups",
  "leadCategories",
  "conversion",
];

function ProfileSection() {
  const { t, lang, setLang } = useI18n();
  const { unit, setUnit } = useCurrency();
  const { dark, setDark } = useTheme();
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();

  const [fullName, setFullName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [saving, setSaving] = useState(false);

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await updateProfile.mutateAsync({
        id: user.id,
        patch: { full_name: fullName.trim(), phone: phone.trim() || null },
      });
      toast.success(t("settings.profileUpdated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.profileUpdateFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <SectionCard title={t("settings.profile")}>
        <form onSubmit={onSaveProfile} className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="text-[13px] font-medium text-muted-foreground">
              {t("settings.fullName")}
            </span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none transition-colors focus:border-primary/40 focus:bg-background"
            />
          </label>
          <label className="block">
            <span className="text-[13px] font-medium text-muted-foreground">
              {t("settings.email")}
            </span>
            <input
              value={user?.email ?? ""}
              disabled
              className="mt-2 h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm text-muted-foreground outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[13px] font-medium text-muted-foreground">
              {t("settings.role")}
            </span>
            <input
              value={user?.role ?? ""}
              disabled
              className="mt-2 h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm capitalize text-muted-foreground outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[13px] font-medium text-muted-foreground">
              {t("settings.phone")}
            </span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+998 90 123 45 67"
              className="mt-2 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none transition-colors focus:border-primary/40 focus:bg-background"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("settings.saveChanges")}
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title={t("settings.preferences")}>
        <div className="space-y-6">
          <div>
            <span className="text-[13px] font-medium text-muted-foreground">
              {t("settings.currency")}
            </span>
            <div className="mt-2">
              <SegmentedControl value={unit} options={CURRENCIES} onChange={setUnit} />
            </div>
          </div>
          <div>
            <span className="text-[13px] font-medium text-muted-foreground">
              {t("settings.language")}
            </span>
            <div className="mt-2">
              <SegmentedControl
                value={lang}
                options={LANGS}
                render={(l) => LANG_LABELS[l]}
                onChange={setLang}
              />
            </div>
          </div>
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-[13px] font-medium text-muted-foreground">
                {t("settings.appearance")}
              </p>
              <p className="mt-1 text-xs text-subtle">{t("settings.appearanceDesc")}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={dark}
              onClick={() => setDark(!dark)}
              className={cn(
                "relative mt-1 inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors",
                dark ? "bg-foreground" : "bg-warning/25",
              )}
            >
              <span
                className={cn(
                  "absolute left-1 flex h-6 w-6 items-center justify-center rounded-full bg-background shadow-soft transition-transform duration-200",
                  dark && "translate-x-6",
                )}
              >
                {dark ? (
                  <Moon className="h-3.5 w-3.5 text-foreground" />
                ) : (
                  <Sun className="h-3.5 w-3.5 text-warning" />
                )}
              </span>
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function BusinessProfileSection() {
  const { t } = useI18n();
  const { user } = useAuth();
  const canManage = user?.role === "super_admin" || user?.role === "manager";
  const { data: profile, isLoading } = useBusinessProfile();
  const updateProfile = useUpdateBusinessProfile();

  const [companyName, setCompanyName] = useState(profile?.company_name ?? "");
  const [description, setDescription] = useState(profile?.description ?? "");
  const [competitors, setCompetitors] = useState(profile?.competitors ?? "");
  const [terminology, setTerminology] = useState(profile?.terminology ?? "");
  const [tone, setTone] = useState(profile?.tone ?? "");
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile || hydrated) return;
    setCompanyName(profile.company_name);
    setDescription(profile.description);
    setCompetitors(profile.competitors);
    setTerminology(profile.terminology);
    setTone(profile.tone);
    setHydrated(true);
  }, [profile, hydrated]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile.mutateAsync({
        company_name: companyName.trim(),
        description: description.trim(),
        competitors: competitors.trim(),
        terminology: terminology.trim(),
        tone: tone.trim(),
      });
      toast.success(t("settings.business.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.business.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard title={t("settings.business.title")} description={t("settings.business.desc")}>
      {isLoading && (
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
        </div>
      )}
      {!canManage && (
        <p className="mb-4 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-subtle">
          {t("settings.business.readOnlyHint")}
        </p>
      )}
      <form onSubmit={onSave} className="grid gap-5 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-[13px] font-medium text-muted-foreground">
            {t("settings.business.companyName")}
          </span>
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            disabled={!canManage}
            className="mt-2 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none transition-colors focus:border-primary/40 focus:bg-background disabled:bg-muted disabled:text-muted-foreground"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[13px] font-medium text-muted-foreground">
            {t("settings.business.description")}
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!canManage}
            className="mt-2 h-20 w-full resize-none rounded-xl border border-border bg-surface p-3 text-sm outline-none transition-colors focus:border-primary/40 focus:bg-background disabled:bg-muted disabled:text-muted-foreground"
          />
        </label>
        <label className="block">
          <span className="text-[13px] font-medium text-muted-foreground">
            {t("settings.business.competitors")}
          </span>
          <input
            value={competitors}
            onChange={(e) => setCompetitors(e.target.value)}
            disabled={!canManage}
            className="mt-2 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none transition-colors focus:border-primary/40 focus:bg-background disabled:bg-muted disabled:text-muted-foreground"
          />
        </label>
        <label className="block">
          <span className="text-[13px] font-medium text-muted-foreground">
            {t("settings.business.tone")}
          </span>
          <input
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            disabled={!canManage}
            className="mt-2 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none transition-colors focus:border-primary/40 focus:bg-background disabled:bg-muted disabled:text-muted-foreground"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[13px] font-medium text-muted-foreground">
            {t("settings.business.terminology")}
          </span>
          <textarea
            value={terminology}
            onChange={(e) => setTerminology(e.target.value)}
            disabled={!canManage}
            className="mt-2 h-20 w-full resize-none rounded-xl border border-border bg-surface p-3 text-sm outline-none transition-colors focus:border-primary/40 focus:bg-background disabled:bg-muted disabled:text-muted-foreground"
          />
        </label>
        {canManage && (
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("settings.saveChanges")}
            </button>
          </div>
        )}
      </form>
    </SectionCard>
  );
}

function StageRowEditor({
  stage,
  leadCount,
  canManage,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  stage: StageRow;
  leadCount: number;
  canManage: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { t } = useI18n();
  const updateStage = useUpdateStage();
  const deleteStage = useDeleteStage();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(stage.name);
  const [color, setColor] = useState(stage.color);
  const [probability, setProbability] = useState(String(stage.probability));
  const [status, setStatus] = useState<"active" | "won" | "lost">(
    stage.is_won ? "won" : stage.is_lost ? "lost" : "active",
  );

  async function save() {
    try {
      await updateStage.mutateAsync({
        id: stage.id,
        patch: {
          name: name.trim() || stage.name,
          color,
          probability: Number(probability) || 0,
          is_won: status === "won",
          is_lost: status === "lost",
        },
      });
      toast.success(t("settings.stages.updated"));
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.stages.actionFailed"));
    }
  }

  async function remove() {
    try {
      await deleteStage.mutateAsync(stage.id);
      toast.success(t("settings.stages.deleted"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.stages.actionFailed"));
    } finally {
      setConfirmDelete(false);
    }
  }

  if (!editing) {
    return (
      <li className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-3">
          {canManage && (
            <div className="flex flex-col">
              <button
                onClick={onMoveUp}
                disabled={isFirst}
                className="text-subtle hover:text-foreground disabled:opacity-30"
                aria-label="up"
              >
                <ArrowUp className="h-3 w-3" />
              </button>
              <button
                onClick={onMoveDown}
                disabled={isLast}
                className="text-subtle hover:text-foreground disabled:opacity-30"
                aria-label="down"
              >
                <ArrowDown className="h-3 w-3" />
              </button>
            </div>
          )}
          <span className={cn("h-2.5 w-2.5 rounded-full", stage.color)} />
          <div>
            <p className="text-sm font-medium text-foreground">{stage.name}</p>
            <p className="text-xs text-subtle">
              {t("settings.stages.leadCount", { count: leadCount })} · {stage.probability}%
            </p>
          </div>
          {stage.is_won && <Pill tone="success">{t("settings.stages.statusWon")}</Pill>}
          {stage.is_lost && <Pill tone="danger">{t("settings.stages.statusLost")}</Pill>}
        </div>
        {canManage && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg p-2 text-subtle hover:bg-accent hover:text-foreground"
              aria-label={t("admin.editRole")}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded-lg p-2 text-subtle hover:bg-destructive/10 hover:text-destructive"
              aria-label={t("settings.stages.deleteConfirmTitle")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={t("settings.stages.deleteConfirmTitle")}
          description={t("settings.stages.deleteConfirmDesc", { name: stage.name })}
          onConfirm={remove}
        />
      </li>
    );
  }

  return (
    <li className="space-y-3 rounded-xl border border-primary/30 bg-surface px-4 py-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">
            {t("settings.stages.name")}
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1.5 h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus:border-primary/40"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">
            {t("settings.stages.probability")}
          </span>
          <input
            type="number"
            min={0}
            max={100}
            value={probability}
            onChange={(e) => setProbability(e.target.value)}
            className="mt-1.5 h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus:border-primary/40"
          />
        </label>
      </div>
      <div>
        <span className="text-xs font-medium text-muted-foreground">
          {t("settings.stages.color")}
        </span>
        <div className="mt-1.5 flex items-center gap-2">
          {STAGE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                "h-6 w-6 rounded-full ring-offset-2 ring-offset-surface transition-shadow",
                c,
                color === c && "ring-2 ring-primary",
              )}
              aria-label={c}
            />
          ))}
        </div>
      </div>
      <div>
        <span className="text-xs font-medium text-muted-foreground">
          {t("settings.stages.status")}
        </span>
        <div className="mt-1.5">
          <SegmentedControl
            value={status}
            options={["active", "won", "lost"] as const}
            render={(v) =>
              v === "active"
                ? t("settings.stages.statusActive")
                : v === "won"
                  ? t("settings.stages.statusWon")
                  : t("settings.stages.statusLost")
            }
            onChange={setStatus}
            size="sm"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={save}
          disabled={updateStage.isPending}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-60"
        >
          {updateStage.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {t("common.save")}
        </button>
        <button
          onClick={() => setEditing(false)}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground hover:bg-accent"
        >
          <X className="h-3.5 w-3.5" /> {t("common.cancel")}
        </button>
      </div>
    </li>
  );
}

function StagesSection() {
  const { t } = useI18n();
  const { user } = useAuth();
  const canManage = user?.role === "super_admin" || user?.role === "manager";
  const { data: stages, isLoading } = usePipelineStagesRaw();
  const { rows: leads } = useCrmLeads();
  const createStage = useCreateStage();
  const updateStage = useUpdateStage();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const sorted = [...(stages ?? [])].sort((a, b) => a.position - b.position);
  const leadCountByStage = (id: string) => leads.filter((l) => l.stageId === id).length;

  async function move(index: number, dir: -1 | 1) {
    const target = sorted[index + dir];
    const current = sorted[index];
    if (!target || !current) return;
    try {
      await Promise.all([
        updateStage.mutateAsync({ id: current.id, patch: { position: target.position } }),
        updateStage.mutateAsync({ id: target.id, patch: { position: current.position } }),
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.stages.actionFailed"));
    }
  }

  async function addStage(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const base = newName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const existingKeys = new Set(sorted.map((s) => s.key));
      let key = base || "stage";
      let n = 2;
      while (existingKeys.has(key)) key = `${base}-${n++}`;
      const nextPosition = sorted.length ? Math.max(...sorted.map((s) => s.position)) + 1 : 1;
      await createStage.mutateAsync({
        key,
        name: newName.trim(),
        position: nextPosition,
        color: "bg-primary",
        probability: 10,
      });
      toast.success(t("settings.stages.created"));
      setNewName("");
      setAdding(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.stages.actionFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard
      title={t("settings.stages.title")}
      description={t("settings.stages.desc")}
      actions={
        canManage && (
          <button
            onClick={() => setAdding((a) => !a)}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> {t("settings.stages.add")}
          </button>
        )
      }
    >
      {isLoading && (
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
        </div>
      )}
      {adding && (
        <form
          onSubmit={addStage}
          className="mb-4 flex items-center gap-2 rounded-xl border border-primary/30 bg-surface p-3"
        >
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("settings.stages.name")}
            className="h-9 flex-1 rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus:border-primary/40"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t("common.save")}
          </button>
        </form>
      )}
      <ul className="space-y-2">
        {sorted.map((s, i) => (
          <StageRowEditor
            key={s.id}
            stage={s}
            leadCount={leadCountByStage(s.id)}
            canManage={canManage}
            isFirst={i === 0}
            isLast={i === sorted.length - 1}
            onMoveUp={() => void move(i, -1)}
            onMoveDown={() => void move(i, 1)}
          />
        ))}
      </ul>
    </SectionCard>
  );
}

function TagsSection() {
  const { t } = useI18n();
  const { user } = useAuth();
  const canManage = user?.role === "super_admin" || user?.role === "manager";
  const { tags, isLoading } = useTagsSummary();
  const renameTag = useRenameTag();
  const deleteTag = useDeleteTag();
  const [query, setQuery] = useState("");
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const visible = tags.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()));

  async function rename(from: string) {
    const to = draftName.trim();
    if (!to || to === from) {
      setEditingTag(null);
      return;
    }
    try {
      await renameTag.mutateAsync({ from, to });
      toast.success(t("settings.tags.renamed"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.tags.actionFailed"));
    } finally {
      setEditingTag(null);
    }
  }

  async function remove(tag: string) {
    try {
      await deleteTag.mutateAsync(tag);
      toast.success(t("settings.tags.deletedToast"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.tags.actionFailed"));
    } finally {
      setConfirmDelete(null);
    }
  }

  return (
    <SectionCard
      title={t("settings.tags.title")}
      description={t("settings.tags.desc")}
      actions={
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("settings.tags.search")}
          className="h-10 w-56 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary/40"
        />
      }
    >
      {isLoading && (
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
        </div>
      )}
      {!isLoading && visible.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">{t("settings.tags.empty")}</p>
      )}
      <ul className="space-y-2">
        {visible.map((tag) => (
          <li
            key={tag.name}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-2.5"
          >
            {editingTag === tag.name ? (
              <input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void rename(tag.name);
                  if (e.key === "Escape") setEditingTag(null);
                }}
                onBlur={() => void rename(tag.name)}
                className="h-9 flex-1 rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus:border-primary/40"
              />
            ) : (
              <div className="flex items-center gap-2">
                <TagIcon className="h-3.5 w-3.5 text-subtle" />
                <span className="text-sm font-medium text-foreground">{tag.name}</span>
                <span className="text-xs text-subtle">
                  {t("settings.tags.leadCount", { count: tag.count })}
                </span>
              </div>
            )}
            {canManage && editingTag !== tag.name && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setEditingTag(tag.name);
                    setDraftName(tag.name);
                  }}
                  className="rounded-lg p-2 text-subtle hover:bg-accent hover:text-foreground"
                  aria-label={t("settings.tags.rename")}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setConfirmDelete(tag.name)}
                  className="rounded-lg p-2 text-subtle hover:bg-destructive/10 hover:text-destructive"
                  aria-label={t("settings.tags.delete")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title={confirmDelete ? t("settings.tags.deleteConfirmTitle", { tag: confirmDelete }) : ""}
        description={
          confirmDelete
            ? t("settings.tags.deleteConfirmDesc", {
                count: tags.find((t) => t.name === confirmDelete)?.count ?? 0,
              })
            : ""
        }
        onConfirm={() => confirmDelete && void remove(confirmDelete)}
      />
    </SectionCard>
  );
}

function UsersSection() {
  const { t } = useI18n();
  const { user } = useAuth();
  const isAdmin = user?.role === "super_admin";
  return (
    <SectionCard title={t("settings.users.title")} description={t("settings.users.desc")}>
      {isAdmin ? (
        <Link
          to="/admin"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          {t("settings.users.openAdmin")}
        </Link>
      ) : (
        <p className="text-sm text-subtle">{t("settings.users.restricted")}</p>
      )}
    </SectionCard>
  );
}

function ComingSoonSection({ label }: { label: string }) {
  const { t } = useI18n();
  return (
    <SectionCard title={label}>
      <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
        <p className="text-sm font-semibold text-foreground">{t("settings.comingSoonTitle")}</p>
        <p className="mt-1 text-sm text-subtle">{t("settings.comingSoonDesc")}</p>
      </div>
    </SectionCard>
  );
}

function SettingsPage() {
  const { t } = useI18n();
  const { tags } = useTagsSummary();
  const { data: stages } = usePipelineStagesRaw();
  const [section, setSection] = useState<SectionKey>("profile");

  const NAV: { key: SectionKey; icon: LucideIcon; label: string; badge?: number | undefined }[] = [
    { key: "profile", icon: Users, label: t("settings.nav.profile") },
    { key: "business", icon: Building2, label: t("settings.nav.business") },
    { key: "stages", icon: Workflow, label: t("settings.nav.stages"), badge: stages?.length },
    { key: "tags", icon: TagIcon, label: t("settings.nav.tags"), badge: tags.length },
    { key: "users", icon: Users, label: t("settings.nav.users") },
    { key: "categories", icon: LayoutGrid, label: t("settings.nav.categories") },
    { key: "salesStages", icon: Workflow, label: t("settings.nav.salesStages") },
    { key: "scoreModifiers", icon: SlidersHorizontal, label: t("settings.nav.scoreModifiers") },
    { key: "skills", icon: Award, label: t("settings.nav.skills") },
    { key: "qualificationGroups", icon: ListChecks, label: t("settings.nav.qualificationGroups") },
    { key: "leadCategories", icon: Thermometer, label: t("settings.nav.leadCategories") },
    { key: "conversion", icon: TrendingUp, label: t("settings.nav.conversion") },
  ];

  return (
    <>
      <PageHeader title={t("settings.title")} description={t("settings.desc")} />

      <div className="mt-6 grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
        <nav className="space-y-1">
          {NAV.map((item) => (
            <button
              key={item.key}
              onClick={() => setSection(item.key)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                section === item.key
                  ? "bg-mint text-mint-foreground"
                  : "text-muted-foreground hover:bg-accent",
                COMING_SOON.includes(item.key) && "opacity-70",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="ml-auto rounded-md bg-background px-1.5 py-0.5 text-[11px] font-semibold text-subtle">
                  {item.badge}
                </span>
              )}
              {COMING_SOON.includes(item.key) && (
                <span className="ml-auto rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-subtle">
                  {t("settings.comingSoonBadge")}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div>
          {section === "profile" && <ProfileSection />}
          {section === "business" && <BusinessProfileSection />}
          {section === "stages" && <StagesSection />}
          {section === "tags" && <TagsSection />}
          {section === "users" && <UsersSection />}
          {COMING_SOON.includes(section) && (
            <ComingSoonSection label={NAV.find((n) => n.key === section)?.label ?? ""} />
          )}
        </div>
      </div>
    </>
  );
}
