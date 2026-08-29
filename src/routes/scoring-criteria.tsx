import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Loader2,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionCard, Pill } from "@/components/layout/Primitives";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  useCallCategories,
  useCreateCallCategory,
  useUpdateCallCategory,
  useDeleteCallCategory,
  useCallStagesRaw,
  useCreateCallStage,
  useUpdateCallStage,
  useDeleteCallStage,
  useCallStageStepsRaw,
  useCreateCallStageStep,
  useUpdateCallStageStep,
  useDeleteCallStageStep,
  useCallSkills,
  useServiceLines,
  useCreateServiceLine,
  useUpdateServiceLine,
  useDeleteServiceLine,
  useIntakeQuestions,
  useCreateIntakeQuestion,
  useUpdateIntakeQuestion,
  useDeleteIntakeQuestion,
  useLeadQualityStages,
  useCreateLeadQualityStage,
  useUpdateLeadQualityStage,
  useDeleteLeadQualityStage,
  useAiAgents,
  useUpdateAiAgent,
  usePipelineStagesRaw,
  useUpdateStage,
  type CallCategoryRow,
  type CallStageRow,
  type CallStageStepRow,
  type ServiceLineRow,
  type IntakeQuestionRow,
  type LeadQualityStageRow,
} from "@/hooks/use-crm-data";

function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
    return err.message || fallback;
  }
  return fallback;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function linesToArray(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export const Route = createFileRoute("/scoring-criteria")({
  head: () => ({
    meta: [
      { title: "Baholash mezoni — SalesOS Elite" },
      {
        name: "description",
        content: "AI qo'ng'iroq tahlili uchun baholash mezonlari, savollar va yo'riqnomalar.",
      },
    ],
  }),
  component: ScoringCriteriaPage,
});

const inputCls =
  "h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary/40";
const textareaCls =
  "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary/40";

const TABS = [
  "rubric",
  "intake",
  "services",
  "families",
  "leadQuality",
  "aiInstructions",
  "leadAnalytics",
  "outcomes",
] as const;
type Tab = (typeof TABS)[number];

function useCanManage() {
  const { user } = useAuth();
  return user?.role === "super_admin" || user?.role === "rop" || user?.role === "platform_owner";
}

/* ===================================================================== */
/* Tab 1 — Baholash mezonlari: weighted stages, each with graded steps    */
/* (code + 4-level rubric), optionally tagged to a category.              */
/* ===================================================================== */

function RubricStepRow({
  step,
  skills,
  canManage,
}: {
  step: CallStageStepRow;
  skills: ReturnType<typeof useCallSkills>["data"];
  canManage: boolean;
}) {
  const updateStep = useUpdateCallStageStep();
  const deleteStep = useDeleteCallStageStep();
  const [expanded, setExpanded] = useState(false);
  const [code, setCode] = useState(step.code ?? "");
  const [name, setName] = useState(step.name);
  const [points, setPoints] = useState(String(step.points));
  const [skillId, setSkillId] = useState(step.skill_id ?? "");
  const [l0, setL0] = useState(step.level_0_desc);
  const [l1, setL1] = useState(step.level_1_desc);
  const [l2, setL2] = useState(step.level_2_desc);
  const [l3, setL3] = useState(step.level_3_desc);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const skill = (skills ?? []).find((s) => s.id === step.skill_id);

  async function save() {
    setSaving(true);
    try {
      await updateStep.mutateAsync({
        id: step.id,
        patch: {
          code: code.trim() || null,
          name: name.trim() || step.name,
          points: Number(points) || 0,
          skill_id: skillId || null,
          level_0_desc: l0,
          level_1_desc: l1,
          level_2_desc: l2,
          level_3_desc: l3,
        },
      });
      toast.success("Saqlandi");
      setExpanded(false);
    } catch (err) {
      toast.error(errorMessage(err, "Amalni bajarib bo'lmadi"));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    try {
      await deleteStep.mutateAsync(step.id);
      toast.success("O'chirildi");
    } catch (err) {
      toast.error(errorMessage(err, "Amalni bajarib bo'lmadi"));
    } finally {
      setConfirmDelete(false);
    }
  }

  return (
    <li className="rounded-lg border border-border bg-background px-3 py-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-subtle transition-transform",
              expanded && "rotate-180",
            )}
          />
          {step.code && (
            <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-subtle">
              {step.code}
            </span>
          )}
          <span className="font-medium text-foreground">{step.name}</span>
          {skill && (
            <span className="flex items-center gap-1 text-subtle">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: skill.color }}
              />
              {skill.name}
            </span>
          )}
          <span className="text-subtle">· {step.points} ball</span>
        </button>
        {canManage && (
          <span className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded-md p-1.5 text-subtle hover:bg-destructive/10 hover:text-destructive"
              aria-label="O'chirish"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        )}
      </div>
      {expanded && (
        <div className="mt-2.5 space-y-2 border-t border-border pt-2.5">
          <div className="flex flex-wrap gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Kod (masalan A1)"
              disabled={!canManage}
              className="h-8 w-28 rounded-md border border-border bg-surface px-2 text-xs outline-none focus:border-primary/40"
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mezon nomi"
              disabled={!canManage}
              className="h-8 min-w-[160px] flex-1 rounded-md border border-border bg-surface px-2 text-xs outline-none focus:border-primary/40"
            />
            <select
              value={skillId}
              onChange={(e) => setSkillId(e.target.value)}
              disabled={!canManage}
              className="h-8 rounded-md border border-border bg-surface px-2 text-xs outline-none focus:border-primary/40"
            >
              <option value="">Skill yo'q</option>
              {(skills ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              disabled={!canManage}
              className="h-8 w-16 rounded-md border border-border bg-surface px-2 text-xs outline-none focus:border-primary/40"
            />
          </div>
          {(
            [
              ["0 ball — bajarilmagan", l0, setL0],
              ["1 ball — qisman", l1, setL1],
              ["2 ball — yaxshi", l2, setL2],
              ["3 ball — a'lo", l3, setL3],
            ] as const
          ).map(([label, val, setter]) => (
            <div key={label}>
              <p className="mb-1 text-[11px] font-medium text-subtle">{label}</p>
              <textarea
                value={val}
                onChange={(e) => setter(e.target.value)}
                disabled={!canManage}
                rows={2}
                className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:border-primary/40"
              />
            </div>
          ))}
          {canManage && (
            <button
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Saqlash
            </button>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`"${step.name}" o'chirilsinmi?`}
        description="Bu amalni ortga qaytarib bo'lmaydi."
        onConfirm={() => void remove()}
      />
    </li>
  );
}

function RubricStageCard({
  stage,
  categories,
  skills,
  steps,
  canManage,
}: {
  stage: CallStageRow;
  categories: CallCategoryRow[];
  skills: ReturnType<typeof useCallSkills>["data"];
  steps: CallStageStepRow[];
  canManage: boolean;
}) {
  const { user } = useAuth();
  const updateStage = useUpdateCallStage();
  const deleteStage = useDeleteCallStage();
  const createStep = useCreateCallStageStep();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(stage.name);
  const [weight, setWeight] = useState(String(stage.weight_percent));
  const [newStepName, setNewStepName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const stageSteps = steps.filter((s) => s.stage_id === stage.id);

  async function saveName() {
    try {
      await updateStage.mutateAsync({ id: stage.id, patch: { name: name.trim() || stage.name } });
      setEditingName(false);
    } catch (err) {
      toast.error(errorMessage(err, "Amalni bajarib bo'lmadi"));
    }
  }

  async function saveWeight() {
    try {
      await updateStage.mutateAsync({
        id: stage.id,
        patch: { weight_percent: Number(weight) || 0 },
      });
    } catch (err) {
      toast.error(errorMessage(err, "Amalni bajarib bo'lmadi"));
    }
  }

  async function changeCategory(id: string) {
    try {
      await updateStage.mutateAsync({ id: stage.id, patch: { category_id: id || null } });
    } catch (err) {
      toast.error(errorMessage(err, "Amalni bajarib bo'lmadi"));
    }
  }

  async function addStep(e: FormEvent) {
    e.preventDefault();
    if (!newStepName.trim()) return;
    try {
      await createStep.mutateAsync({
        organization_id: user!.organizationId!,
        stage_id: stage.id,
        name: newStepName.trim(),
        points: 1,
        position: stageSteps.length,
      });
      setNewStepName("");
    } catch (err) {
      toast.error(errorMessage(err, "Amalni bajarib bo'lmadi"));
    }
  }

  async function removeStage() {
    try {
      await deleteStage.mutateAsync(stage.id);
      toast.success("O'chirildi");
    } catch (err) {
      toast.error(errorMessage(err, "Amalni bajarib bo'lmadi"));
    } finally {
      setConfirmDelete(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {editingName ? (
          <div className="flex flex-1 items-center gap-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void saveName()}
              className="h-9 min-w-[160px] flex-1 rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus:border-primary/40"
            />
            <button
              onClick={() => void saveName()}
              className="rounded-lg p-2 text-subtle hover:bg-accent hover:text-foreground"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <span className="text-sm font-semibold text-foreground">{stage.name}</span>
        )}
        <div className="flex items-center gap-2">
          {canManage ? (
            <>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  onBlur={() => void saveWeight()}
                  className="h-8 w-16 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary/40"
                />
                <span className="text-xs text-subtle">%</span>
              </div>
              <select
                value={stage.category_id ?? ""}
                onChange={(e) => void changeCategory(e.target.value)}
                className="h-8 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary/40"
              >
                <option value="">Kategoriyasiz</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <Pill tone="info">{stage.weight_percent}%</Pill>
              {(() => {
                const category = categories.find((c) => c.id === stage.category_id);
                return category ? <Pill tone="neutral">{category.name}</Pill> : null;
              })()}
            </>
          )}
          {canManage && !editingName && (
            <>
              <button
                onClick={() => setEditingName(true)}
                className="rounded-lg p-2 text-subtle hover:bg-accent hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="rounded-lg p-2 text-subtle hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
      <ul className="space-y-1.5">
        {stageSteps.map((step) => (
          <RubricStepRow key={step.id} step={step} skills={skills} canManage={canManage} />
        ))}
      </ul>
      {stageSteps.length === 0 && (
        <p className="py-2 text-center text-xs text-subtle">Mezon qo'shilmagan</p>
      )}
      {canManage && (
        <form onSubmit={(e) => void addStep(e)} className="mt-2 flex items-center gap-2">
          <input
            value={newStepName}
            onChange={(e) => setNewStepName(e.target.value)}
            placeholder="Yangi mezon qo'shish"
            className="h-9 flex-1 rounded-lg border border-dashed border-border bg-background px-2.5 text-xs outline-none focus:border-primary/40"
          />
          <button
            type="submit"
            disabled={createStep.isPending || !newStepName.trim()}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-dashed border-border px-3 text-xs font-medium text-subtle transition-colors hover:border-primary/40 hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </form>
      )}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`"${stage.name}" o'chirilsinmi?`}
        description="Ichidagi barcha mezonlar ham o'chib ketadi."
        onConfirm={() => void removeStage()}
      />
    </div>
  );
}

function RubricTab() {
  const canManage = useCanManage();
  const { user } = useAuth();
  const { data: stages = [], isLoading } = useCallStagesRaw();
  const { data: steps = [] } = useCallStageStepsRaw();
  const { data: categories = [] } = useCallCategories();
  const { data: skills = [] } = useCallSkills();
  const createStage = useCreateCallStage();
  const [newStageName, setNewStageName] = useState("");

  const totalWeight = stages.reduce((sum, s) => sum + s.weight_percent, 0);

  async function addStage(e: FormEvent) {
    e.preventDefault();
    if (!newStageName.trim()) return;
    try {
      await createStage.mutateAsync({
        organization_id: user!.organizationId!,
        name: newStageName.trim(),
        weight_percent: 0,
        position: stages.length,
      });
      setNewStageName("");
    } catch (err) {
      toast.error(errorMessage(err, "Amalni bajarib bo'lmadi"));
    }
  }

  return (
    <SectionCard
      title="Baholash mezonlari"
      description="Har bir bosqich o'ziga xos og'irlik (%) va 0–3 balli mezonlarga ega."
      actions={
        <Pill tone={totalWeight === 100 ? "success" : "warning"}>
          Jami og'irlik: {totalWeight}%
        </Pill>
      }
    >
      {canManage && (
        <form onSubmit={(e) => void addStage(e)} className="mb-4 flex flex-wrap items-center gap-2">
          <input
            value={newStageName}
            onChange={(e) => setNewStageName(e.target.value)}
            placeholder="Yangi bosqich (masalan: Salomlashish)"
            className={cn(inputCls, "min-w-[220px] flex-1")}
          />
          <button
            type="submit"
            disabled={createStage.isPending || !newStageName.trim()}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {createStage.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Qo'shish
          </button>
        </form>
      )}
      {isLoading && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda...
        </div>
      )}
      {!isLoading && stages.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">Hali bosqich qo'shilmagan.</p>
      )}
      <div className="space-y-3">
        {stages.map((stage) => (
          <RubricStageCard
            key={stage.id}
            stage={stage}
            categories={categories}
            skills={skills}
            steps={steps}
            canManage={canManage}
          />
        ))}
      </div>
    </SectionCard>
  );
}

/* ===================================================================== */
/* Tab 2 — Anketa savollari                                               */
/* ===================================================================== */

function IntakeQuestionsTab() {
  const canManage = useCanManage();
  const { user } = useAuth();
  const { data: items = [], isLoading } = useIntakeQuestions();
  const { data: lines = [] } = useServiceLines();
  const createItem = useCreateIntakeQuestion();
  const updateItem = useUpdateIntakeQuestion();
  const deleteItem = useDeleteIntakeQuestion();
  const [label, setLabel] = useState("");
  const [lineId, setLineId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editLineId, setEditLineId] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<IntakeQuestionRow | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    try {
      await createItem.mutateAsync({
        organization_id: user!.organizationId!,
        label: label.trim(),
        service_line_id: lineId || null,
        position: items.length,
      });
      setLabel("");
      setLineId("");
    } catch (err) {
      toast.error(errorMessage(err, "Amalni bajarib bo'lmadi"));
    }
  }

  async function save(id: string) {
    try {
      await updateItem.mutateAsync({
        id,
        patch: { label: editLabel.trim(), service_line_id: editLineId || null },
      });
      setEditingId(null);
    } catch (err) {
      toast.error(errorMessage(err, "Amalni bajarib bo'lmadi"));
    }
  }

  async function remove(id: string) {
    try {
      await deleteItem.mutateAsync(id);
      toast.success("O'chirildi");
    } catch (err) {
      toast.error(errorMessage(err, "Amalni bajarib bo'lmadi"));
    } finally {
      setConfirmDelete(null);
    }
  }

  return (
    <SectionCard
      title="Anketa savollari"
      description="AI har bir qo'ng'iroqda javob topishga harakat qiladigan savollar."
    >
      {canManage && (
        <form onSubmit={(e) => void add(e)} className="mb-4 flex flex-wrap items-center gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Savol matni"
            className={cn(inputCls, "min-w-[220px] flex-1")}
          />
          <select
            value={lineId}
            onChange={(e) => setLineId(e.target.value)}
            className="h-10 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary/40"
          >
            <option value="">Umumiy (barcha yo'nalishlar)</option>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={createItem.isPending || !label.trim()}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {createItem.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Qo'shish
          </button>
        </form>
      )}
      {isLoading && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda...
        </div>
      )}
      {!isLoading && items.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">Hali savol qo'shilmagan.</p>
      )}
      <ul className="space-y-2">
        {items.map((item) => {
          const line = lines.find((l) => l.id === item.service_line_id);
          return (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-2.5"
            >
              {editingId === item.id ? (
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <input
                    autoFocus
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void save(item.id)}
                    className="h-9 min-w-[160px] flex-1 rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus:border-primary/40"
                  />
                  <select
                    value={editLineId}
                    onChange={(e) => setEditLineId(e.target.value)}
                    className="h-9 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary/40"
                  >
                    <option value="">Umumiy</option>
                    {lines.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => void save(item.id)}
                    className="rounded-lg p-2 text-subtle hover:bg-accent hover:text-foreground"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                  {line && <Pill tone="neutral">{line.name}</Pill>}
                </div>
              )}
              {canManage && editingId !== item.id && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingId(item.id);
                      setEditLabel(item.label);
                      setEditLineId(item.service_line_id ?? "");
                    }}
                    className="rounded-lg p-2 text-subtle hover:bg-accent hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(item)}
                    className="rounded-lg p-2 text-subtle hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title={confirmDelete ? `"${confirmDelete.label}" o'chirilsinmi?` : ""}
        description="Bu amalni ortga qaytarib bo'lmaydi."
        onConfirm={() => confirmDelete && void remove(confirmDelete.id)}
      />
    </SectionCard>
  );
}

/* ===================================================================== */
/* Tab 3 — Xizmat yo'nalishlari                                           */
/* ===================================================================== */

function ServiceLineCard({ line, canManage }: { line: ServiceLineRow; canManage: boolean }) {
  const updateItem = useUpdateServiceLine();
  const deleteItem = useDeleteServiceLine();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(line.name);
  const [description, setDescription] = useState(line.description);
  const [aliases, setAliases] = useState(line.aliases.join("\n"));
  const [phrases, setPhrases] = useState(line.sample_phrases.join("\n"));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateItem.mutateAsync({
        id: line.id,
        patch: {
          name: name.trim() || line.name,
          description: description.trim(),
          aliases: linesToArray(aliases),
          sample_phrases: linesToArray(phrases),
        },
      });
      toast.success("Saqlandi");
      setEditing(false);
    } catch (err) {
      toast.error(errorMessage(err, "Amalni bajarib bo'lmadi"));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    try {
      await deleteItem.mutateAsync(line.id);
      toast.success("O'chirildi");
    } catch (err) {
      toast.error(errorMessage(err, "Amalni bajarib bo'lmadi"));
    } finally {
      setConfirmDelete(false);
    }
  }

  if (!editing) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-foreground">{line.name}</p>
            {line.description && <p className="mt-1 text-xs text-subtle">{line.description}</p>}
            {line.aliases.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {line.aliases.map((a) => (
                  <Pill key={a} tone="neutral">
                    {a}
                  </Pill>
                ))}
              </div>
            )}
          </div>
          {canManage && (
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => setEditing(true)}
                className="rounded-lg p-2 text-subtle hover:bg-accent hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="rounded-lg p-2 text-subtle hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={`"${line.name}" o'chirilsinmi?`}
          description="Bu amalni ortga qaytarib bo'lmaydi."
          onConfirm={() => void remove()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-primary/30 bg-surface p-4">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={inputCls}
        placeholder="Nomi"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className={textareaCls}
        placeholder="Tavsif"
      />
      <div>
        <p className="mb-1 text-[11px] font-medium text-subtle">
          Sinonimlar (har birini yangi qatorga)
        </p>
        <textarea
          value={aliases}
          onChange={(e) => setAliases(e.target.value)}
          rows={2}
          className={textareaCls}
        />
      </div>
      <div>
        <p className="mb-1 text-[11px] font-medium text-subtle">
          Namunaviy iboralar (har birini yangi qatorga)
        </p>
        <textarea
          value={phrases}
          onChange={(e) => setPhrases(e.target.value)}
          rows={2}
          className={textareaCls}
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Saqlash
        </button>
        <button
          onClick={() => setEditing(false)}
          className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-medium text-subtle hover:bg-accent"
        >
          Bekor qilish
        </button>
      </div>
    </div>
  );
}

function ServiceLinesTab() {
  const canManage = useCanManage();
  const { user } = useAuth();
  const { data: lines = [], isLoading } = useServiceLines();
  const createItem = useCreateServiceLine();
  const [name, setName] = useState("");

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await createItem.mutateAsync({
        organization_id: user!.organizationId!,
        name: name.trim(),
        position: lines.length,
      });
      setName("");
    } catch (err) {
      toast.error(errorMessage(err, "Amalni bajarib bo'lmadi"));
    }
  }

  return (
    <SectionCard
      title="Xizmat yo'nalishlari"
      description="Kompaniyangiz sotadigan mahsulot/xizmat yo'nalishlari — AI qo'ng'iroqni shularga moslab tasniflaydi."
    >
      {canManage && (
        <form onSubmit={(e) => void add(e)} className="mb-4 flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Yangi yo'nalish nomi"
            className={cn(inputCls, "min-w-[220px] flex-1")}
          />
          <button
            type="submit"
            disabled={createItem.isPending || !name.trim()}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {createItem.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Qo'shish
          </button>
        </form>
      )}
      {isLoading && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda...
        </div>
      )}
      {!isLoading && lines.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Hali yo'nalish qo'shilmagan.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {lines.map((line) => (
          <ServiceLineCard key={line.id} line={line} canManage={canManage} />
        ))}
      </div>
    </SectionCard>
  );
}

/* ===================================================================== */
/* Tab 4 — Qo'ng'iroq oilalari (call classification / families)          */
/* ===================================================================== */

function CallFamilyRow({ category, canManage }: { category: CallCategoryRow; canManage: boolean }) {
  const updateItem = useUpdateCallCategory();
  const deleteItem = useDeleteCallCategory();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [scored, setScored] = useState(category.scored);
  const [systemFamily, setSystemFamily] = useState(category.system_family);
  const [workflowFamily, setWorkflowFamily] = useState(category.workflow_family ?? "");
  const [conversationDomain, setConversationDomain] = useState(category.conversation_domain ?? "");
  const [temporary, setTemporary] = useState(category.temporary);
  const [exclusionReason, setExclusionReason] = useState(category.exclusion_reason ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateItem.mutateAsync({
        id: category.id,
        patch: {
          name: name.trim() || category.name,
          scored,
          system_family: systemFamily,
          workflow_family: workflowFamily.trim() || null,
          conversation_domain: conversationDomain.trim() || null,
          temporary,
          exclusion_reason: exclusionReason.trim() || null,
        },
      });
      toast.success("Saqlandi");
      setEditing(false);
    } catch (err) {
      toast.error(errorMessage(err, "Amalni bajarib bo'lmadi"));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    try {
      await deleteItem.mutateAsync(category.id);
      toast.success("O'chirildi");
    } catch (err) {
      toast.error(errorMessage(err, "Amalni bajarib bo'lmadi"));
    } finally {
      setConfirmDelete(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{category.name}</span>
          <Pill tone={category.scored ? "success" : "neutral"}>
            {category.scored ? "Baholanadi" : "Baholanmaydi"}
          </Pill>
          {category.system_family && <Pill tone="info">Tizimli</Pill>}
          {category.temporary && <Pill tone="warning">Vaqtinchalik</Pill>}
        </div>
        {canManage && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setEditing((v) => !v)}
              className="rounded-lg p-2 text-subtle hover:bg-accent hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded-lg p-2 text-subtle hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      {(category.workflow_family || category.conversation_domain || category.exclusion_reason) &&
        !editing && (
          <div className="mt-2 space-y-0.5 text-xs text-subtle">
            {category.workflow_family && <p>Workflow: {category.workflow_family}</p>}
            {category.conversation_domain && <p>Domen: {category.conversation_domain}</p>}
            {category.exclusion_reason && <p>Sabab: {category.exclusion_reason}</p>}
          </div>
        )}
      {editing && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
            placeholder="Nomi"
          />
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-xs text-subtle">
              <input
                type="checkbox"
                checked={scored}
                onChange={(e) => setScored(e.target.checked)}
              />
              Baholanadi (og'irlikli mezonga kiradi)
            </label>
            <label className="flex items-center gap-2 text-xs text-subtle">
              <input
                type="checkbox"
                checked={systemFamily}
                onChange={(e) => setSystemFamily(e.target.checked)}
              />
              Tizimli oila
            </label>
            <label className="flex items-center gap-2 text-xs text-subtle">
              <input
                type="checkbox"
                checked={temporary}
                onChange={(e) => setTemporary(e.target.checked)}
              />
              Vaqtinchalik
            </label>
          </div>
          <input
            value={workflowFamily}
            onChange={(e) => setWorkflowFamily(e.target.value)}
            className={inputCls}
            placeholder="Workflow oilasi (masalan: sotuv, qo'llab-quvvatlash)"
          />
          <input
            value={conversationDomain}
            onChange={(e) => setConversationDomain(e.target.value)}
            className={inputCls}
            placeholder="Suhbat domeni (masalan: narx bo'yicha savol)"
          />
          <input
            value={exclusionReason}
            onChange={(e) => setExclusionReason(e.target.value)}
            className={inputCls}
            placeholder="Baholanmaslik sababi (agar 'Baholanadi' o'chirilgan bo'lsa)"
          />
          <button
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Saqlash
          </button>
        </div>
      )}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`"${category.name}" o'chirilsinmi?`}
        description="Ushbu oilaga bog'langan bosqichlar kategoriyasiz qoladi."
        onConfirm={() => void remove()}
      />
    </div>
  );
}

function CallFamiliesTab() {
  const canManage = useCanManage();
  const { user } = useAuth();
  const { data: items = [], isLoading } = useCallCategories();
  const createItem = useCreateCallCategory();
  const [name, setName] = useState("");

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await createItem.mutateAsync({
        organization_id: user!.organizationId!,
        name: name.trim(),
        position: items.length,
      });
      setName("");
    } catch (err) {
      toast.error(errorMessage(err, "Amalni bajarib bo'lmadi"));
    }
  }

  return (
    <SectionCard
      title="Qo'ng'iroq oilalari"
      description="Qo'ng'iroq turlarini tasniflang va qaysilari umuman baholanmasligini belgilang."
    >
      {canManage && (
        <form onSubmit={(e) => void add(e)} className="mb-4 flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Yangi oila nomi"
            className={cn(inputCls, "min-w-[220px] flex-1")}
          />
          <button
            type="submit"
            disabled={createItem.isPending || !name.trim()}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {createItem.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Qo'shish
          </button>
        </form>
      )}
      {isLoading && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda...
        </div>
      )}
      {!isLoading && items.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">Hali oila qo'shilmagan.</p>
      )}
      <div className="space-y-3">
        {items.map((c) => (
          <CallFamilyRow key={c.id} category={c} canManage={canManage} />
        ))}
      </div>
    </SectionCard>
  );
}

/* ===================================================================== */
/* Tab 5 — Lid sifati bosqichlari                                         */
/* ===================================================================== */

function LeadQualityTab() {
  const canManage = useCanManage();
  const { user } = useAuth();
  const { data: items = [], isLoading } = useLeadQualityStages();
  const createItem = useCreateLeadQualityStage();
  const updateItem = useUpdateLeadQualityStage();
  const deleteItem = useDeleteLeadQualityStage();
  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editConditions, setEditConditions] = useState("");
  const [editQualified, setEditQualified] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<LeadQualityStageRow | null>(null);

  const sorted = [...items].sort((a, b) => a.position - b.position);
  const movable = sorted.filter((s) => !s.system_locked);
  const locked = sorted.filter((s) => s.system_locked);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await createItem.mutateAsync({
        organization_id: user!.organizationId!,
        title: title.trim(),
        qualified: true,
        position: movable.length,
      });
      setTitle("");
    } catch (err) {
      toast.error(errorMessage(err, "Amalni bajarib bo'lmadi"));
    }
  }

  async function save(id: string) {
    try {
      await updateItem.mutateAsync({
        id,
        patch: {
          title: editTitle.trim(),
          conditions: linesToArray(editConditions),
          qualified: editQualified,
        },
      });
      setEditingId(null);
    } catch (err) {
      toast.error(errorMessage(err, "Amalni bajarib bo'lmadi"));
    }
  }

  async function remove(id: string) {
    try {
      await deleteItem.mutateAsync(id);
      toast.success("O'chirildi");
    } catch (err) {
      toast.error(errorMessage(err, "Amalni bajarib bo'lmadi"));
    } finally {
      setConfirmDelete(null);
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= movable.length) return;
    const a = movable[index]!;
    const b = movable[target]!;
    try {
      await Promise.all([
        updateItem.mutateAsync({ id: a.id, patch: { position: b.position } }),
        updateItem.mutateAsync({ id: b.id, patch: { position: a.position } }),
      ]);
    } catch (err) {
      toast.error(errorMessage(err, "Amalni bajarib bo'lmadi"));
    }
  }

  function renderRow(stage: LeadQualityStageRow, index: number | null) {
    const isEditing = editingId === stage.id;
    return (
      <li key={stage.id} className="rounded-xl border border-border bg-surface px-4 py-3">
        {isEditing ? (
          <div className="space-y-2">
            <input
              autoFocus
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className={inputCls}
            />
            <textarea
              value={editConditions}
              onChange={(e) => setEditConditions(e.target.value)}
              rows={3}
              placeholder="Shartlar (har birini yangi qatorga)"
              className={textareaCls}
            />
            <label className="flex items-center gap-2 text-xs text-subtle">
              <input
                type="checkbox"
                checked={editQualified}
                onChange={(e) => setEditQualified(e.target.checked)}
              />
              Sifatli lid hisoblanadi
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void save(stage.id)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90"
              >
                <Check className="h-3.5 w-3.5" /> Saqlash
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-medium text-subtle hover:bg-accent"
              >
                Bekor qilish
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              {canManage && index !== null && (
                <div className="flex flex-col pt-0.5">
                  <button
                    onClick={() => void move(index, -1)}
                    disabled={index === 0}
                    className="text-subtle hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => void move(index, 1)}
                    disabled={index === movable.length - 1}
                    className="text-subtle hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>
              )}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{stage.title}</p>
                  <Pill tone={stage.qualified ? "success" : "danger"}>
                    {stage.qualified ? "Sifatli" : "Sifatsiz"}
                  </Pill>
                  {stage.system_locked && <Pill tone="neutral">Tizimli</Pill>}
                </div>
                {stage.conditions.length > 0 && (
                  <ul className="mt-1 list-inside list-disc text-xs text-subtle">
                    {stage.conditions.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            {canManage && !stage.system_locked && (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => {
                    setEditingId(stage.id);
                    setEditTitle(stage.title);
                    setEditConditions(stage.conditions.join("\n"));
                    setEditQualified(stage.qualified);
                  }}
                  className="rounded-lg p-2 text-subtle hover:bg-accent hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setConfirmDelete(stage)}
                  className="rounded-lg p-2 text-subtle hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </li>
    );
  }

  return (
    <SectionCard
      title="Lid sifati bosqichlari"
      description="AI lidni shu tartibda tekshiradi; oxirgi tizimli bosqich har doim yaroqsiz lidlar uchun."
    >
      {canManage && (
        <form onSubmit={(e) => void add(e)} className="mb-4 flex flex-wrap items-center gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Yangi bosqich nomi"
            className={cn(inputCls, "min-w-[220px] flex-1")}
          />
          <button
            type="submit"
            disabled={createItem.isPending || !title.trim()}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {createItem.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Qo'shish
          </button>
        </form>
      )}
      {isLoading && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda...
        </div>
      )}
      <ul className="space-y-2">
        {movable.map((s, i) => renderRow(s, i))}
        {locked.map((s) => renderRow(s, null))}
      </ul>
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title={confirmDelete ? `"${confirmDelete.title}" o'chirilsinmi?` : ""}
        description="Bu amalni ortga qaytarib bo'lmaydi."
        onConfirm={() => confirmDelete && void remove(confirmDelete.id)}
      />
    </SectionCard>
  );
}

/* ===================================================================== */
/* Tab 6 — AI ko'rsatmalari                                                */
/* ===================================================================== */

function AiInstructionsTab() {
  const canManage = useCanManage();
  const { data: agents, isLoading } = useAiAgents();
  const updateAgent = useUpdateAiAgent();
  const agent = agents?.find((a) => a.kind === "call");
  const instructions = asRecord(asRecord(agent?.call_instructions)["instructions"]);

  const [mainGoal, setMainGoal] = useState("");
  const [keyBehaviors, setKeyBehaviors] = useState("");
  const [redFlags, setRedFlags] = useState("");
  const [extraNotes, setExtraNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!agent) return;
    setMainGoal(asString(instructions["mainGoal"]));
    setKeyBehaviors(asStringArray(instructions["keyBehaviors"]).join("\n"));
    setRedFlags(asStringArray(instructions["redFlags"]).join("\n"));
    setExtraNotes(asString(instructions["extraNotes"]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent?.id]);

  async function save() {
    setSaving(true);
    try {
      const existing = asRecord(agent?.call_instructions);
      await updateAgent.mutateAsync({
        kind: "call",
        call_instructions: {
          ...existing,
          instructions: {
            mainGoal: mainGoal.trim(),
            keyBehaviors: linesToArray(keyBehaviors),
            redFlags: linesToArray(redFlags),
            extraNotes: extraNotes.trim(),
          },
        },
      });
      toast.success("Saqlandi");
    } catch (err) {
      toast.error(errorMessage(err, "Amalni bajarib bo'lmadi"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      title="AI ko'rsatmalari"
      description="Qo'ng'iroq tahlili AI agentiga beriladigan qo'shimcha, tuzilgan yo'riqnomalar."
    >
      {isLoading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda...
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="mb-1 text-xs font-medium text-subtle">Asosiy vazifa</p>
            <textarea
              value={mainGoal}
              onChange={(e) => setMainGoal(e.target.value)}
              disabled={!canManage}
              rows={2}
              className={textareaCls}
              placeholder="Masalan: menejer skriptga qanchalik amal qilganini baholash"
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-subtle">
              E'tibor berilishi kerak bo'lgan xatti-harakatlar (har birini yangi qatorga)
            </p>
            <textarea
              value={keyBehaviors}
              onChange={(e) => setKeyBehaviors(e.target.value)}
              disabled={!canManage}
              rows={4}
              className={textareaCls}
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-subtle">
              Qizil chiziqlar / xavf belgilari (har birini yangi qatorga)
            </p>
            <textarea
              value={redFlags}
              onChange={(e) => setRedFlags(e.target.value)}
              disabled={!canManage}
              rows={4}
              className={textareaCls}
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-subtle">Qo'shimcha eslatmalar</p>
            <textarea
              value={extraNotes}
              onChange={(e) => setExtraNotes(e.target.value)}
              disabled={!canManage}
              rows={2}
              className={textareaCls}
            />
          </div>
          {canManage && (
            <button
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Saqlash
            </button>
          )}
        </div>
      )}
    </SectionCard>
  );
}

/* ===================================================================== */
/* Tab 7 — Lid analitikasi                                                */
/* ===================================================================== */

function LeadAnalyticsTab() {
  const canManage = useCanManage();
  const { data: agents, isLoading } = useAiAgents();
  const updateAgent = useUpdateAiAgent();
  const agent = agents?.find((a) => a.kind === "call");
  const leadAnalytics = asRecord(asRecord(agent?.call_instructions)["leadAnalytics"]);

  const [questions, setQuestions] = useState("");
  const [qualificationHints, setQualificationHints] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!agent) return;
    setQuestions(asStringArray(leadAnalytics["questions"]).join("\n"));
    setQualificationHints(asStringArray(leadAnalytics["qualificationHints"]).join("\n"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent?.id]);

  async function save() {
    setSaving(true);
    try {
      const existing = asRecord(agent?.call_instructions);
      await updateAgent.mutateAsync({
        kind: "call",
        call_instructions: {
          ...existing,
          leadAnalytics: {
            questions: linesToArray(questions),
            qualificationHints: linesToArray(qualificationHints),
          },
        },
      });
      toast.success("Saqlandi");
    } catch (err) {
      toast.error(errorMessage(err, "Amalni bajarib bo'lmadi"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      title="Lid analitikasi"
      description="AI har bir qo'ng'iroqdan qanday tahliliy xulosalar chiqarishi kerakligini belgilang."
    >
      {isLoading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda...
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="mb-1 text-xs font-medium text-subtle">
              AI javob topishi kerak bo'lgan savollar (har birini yangi qatorga)
            </p>
            <textarea
              value={questions}
              onChange={(e) => setQuestions(e.target.value)}
              disabled={!canManage}
              rows={4}
              className={textareaCls}
              placeholder="Masalan: Mijoz nima uchun sotib olmadi?"
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-subtle">
              Lid sifatini aniqlash uchun qo'shimcha belgilar (har birini yangi qatorga)
            </p>
            <textarea
              value={qualificationHints}
              onChange={(e) => setQualificationHints(e.target.value)}
              disabled={!canManage}
              rows={4}
              className={textareaCls}
            />
          </div>
          {canManage && (
            <button
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Saqlash
            </button>
          )}
        </div>
      )}
    </SectionCard>
  );
}

/* ===================================================================== */
/* Tab 8 — CRM natija bosqichlari (won/lost)                              */
/* ===================================================================== */

function OutcomeStageRow({
  stage,
  canManage,
}: {
  stage: ReturnType<typeof usePipelineStagesRaw>["data"] extends (infer T)[] | undefined
    ? T
    : never;
  canManage: boolean;
}) {
  const updateStage = useUpdateStage();
  const status: "active" | "won" | "lost" = stage.is_won
    ? "won"
    : stage.is_lost
      ? "lost"
      : "active";

  async function setStatus(next: "active" | "won" | "lost") {
    try {
      await updateStage.mutateAsync({
        id: stage.id,
        patch: { is_won: next === "won", is_lost: next === "lost" },
      });
    } catch (err) {
      toast.error(errorMessage(err, "Amalni bajarib bo'lmadi"));
    }
  }

  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
        <span className="text-sm font-medium text-foreground">{stage.name}</span>
      </div>
      {canManage ? (
        <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
          {(
            [
              ["active", "Faol"],
              ["won", "Yutilgan"],
              ["lost", "Yo'qotilgan"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => void setStatus(value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                status === value
                  ? value === "won"
                    ? "bg-mint text-mint-foreground"
                    : value === "lost"
                      ? "bg-destructive/15 text-destructive"
                      : "bg-primary text-primary-foreground"
                  : "text-subtle hover:bg-accent",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        <>
          {stage.is_won && <Pill tone="success">Yutilgan</Pill>}
          {stage.is_lost && <Pill tone="danger">Yo'qotilgan</Pill>}
          {!stage.is_won && !stage.is_lost && <Pill tone="neutral">Faol</Pill>}
        </>
      )}
    </li>
  );
}

function OutcomesTab() {
  const canManage = useCanManage();
  const { data: stages = [], isLoading } = usePipelineStagesRaw();

  return (
    <SectionCard
      title="CRM natija bosqichlari"
      description="Qaysi bosqichlar 'yutilgan' yoki 'yo'qotilgan' natija sifatida hisoblanishini belgilang — AI va analitika shu belgidan foydalanadi."
    >
      {isLoading && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda...
        </div>
      )}
      <ul className="space-y-2">
        {stages.map((stage) => (
          <OutcomeStageRow key={stage.id} stage={stage} canManage={canManage} />
        ))}
      </ul>
    </SectionCard>
  );
}

/* ===================================================================== */
/* Page shell                                                              */
/* ===================================================================== */

const TAB_LABEL: Record<Tab, string> = {
  rubric: "Baholash mezonlari",
  intake: "Anketa savollari",
  services: "Xizmat yo'nalishlari",
  families: "Qo'ng'iroq oilalari",
  leadQuality: "Lid sifati bosqichlari",
  aiInstructions: "AI ko'rsatmalari",
  leadAnalytics: "Lid analitikasi",
  outcomes: "CRM natija bosqichlari",
};

function ScoringCriteriaPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("rubric");

  if (
    user &&
    user.role !== "super_admin" &&
    user.role !== "rop" &&
    user.role !== "platform_owner"
  ) {
    return (
      <SectionCard title={t("admin.restrictedTitle")} description={t("admin.restrictedDesc")}>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <ShieldAlert className="h-4 w-4" /> {t("admin.restrictedHint")}
        </div>
      </SectionCard>
    );
  }

  return (
    <>
      <PageHeader
        title="Baholash mezoni"
        description="AI qo'ng'iroq tahlili qanday ishlashini shu yerdan sozlang: mezonlar, savollar, yo'riqnomalar."
      />
      <div className="mb-6 flex flex-wrap gap-1.5 rounded-xl border border-border bg-surface p-1.5">
        {TABS.map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:text-sm",
              tab === key
                ? "bg-primary text-primary-foreground shadow-soft"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {TAB_LABEL[key]}
          </button>
        ))}
      </div>
      {tab === "rubric" && <RubricTab />}
      {tab === "intake" && <IntakeQuestionsTab />}
      {tab === "services" && <ServiceLinesTab />}
      {tab === "families" && <CallFamiliesTab />}
      {tab === "leadQuality" && <LeadQualityTab />}
      {tab === "aiInstructions" && <AiInstructionsTab />}
      {tab === "leadAnalytics" && <LeadAnalyticsTab />}
      {tab === "outcomes" && <OutcomesTab />}
    </>
  );
}
