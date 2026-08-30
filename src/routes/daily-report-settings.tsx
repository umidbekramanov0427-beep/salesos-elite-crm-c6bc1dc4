import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bell,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionCard } from "@/components/layout/Primitives";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import {
  useDailyReportSettings,
  useUpdateDailyReportSettings,
  useCallStageStepsRaw,
  useFunnelNames,
  usePipelineStagesRaw,
  useMiniAppAudioRules,
  useCreateMiniAppAudioRule,
  useDeleteMiniAppAudioRule,
} from "@/hooks/use-crm-data";

export const Route = createFileRoute("/daily-report-settings")({
  head: () => ({
    meta: [
      { title: "Kunlik hisobot sozlamalari — SalesOS Elite" },
      {
        name: "description",
        content: "Har kuni avtomatik hisobot yuborishni sozlang.",
      },
    ],
  }),
  component: DailyReportSettingsPage,
});

function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
    return err.message || fallback;
  }
  return fallback;
}

const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "uz", label: "O'zbek tili" },
  { value: "ru", label: "Rus tili" },
  { value: "en", label: "Ingliz tili" },
];

function ToggleRow({
  title,
  description,
  enabled,
  onToggle,
  disabled,
  children,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-base font-semibold text-foreground">{title}</span>
        <div className="flex items-center gap-2.5">
          <Switch checked={enabled} disabled={disabled} onCheckedChange={onToggle} />
          <span className="text-sm text-muted-foreground">
            {enabled ? "Yoqilgan" : "O'chirilgan"}
          </span>
        </div>
      </div>
      <p className="mt-1.5 text-sm text-subtle">{description}</p>
      {children}
    </div>
  );
}

function ManagerConversionCriteria({
  criterionIds,
  onChange,
  disabled,
}: {
  criterionIds: string[] | null;
  onChange: (ids: string[] | null) => void;
  disabled?: boolean;
}) {
  const { data: steps } = useCallStageStepsRaw();
  const all = steps ?? [];
  const selectedSet = criterionIds === null ? null : new Set(criterionIds);

  function toggle(id: string, checked: boolean) {
    const base = criterionIds === null ? all.map((s) => s.id) : criterionIds;
    const next = checked ? Array.from(new Set([...base, id])) : base.filter((x) => x !== id);
    onChange(next.length === all.length ? null : next);
  }

  if (all.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl border border-border bg-background p-4">
      <p className="text-base font-semibold text-foreground">
        Hisobot tavsiyasida ishlatiladigan mezonlar
      </p>
      <p className="mt-1 text-sm text-subtle">
        Belgini olib tashlagan mezon faqat shu konversiya tavsiyasi blokida ko'rsatilmaydi.
      </p>
      <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
        {all.map((s) => {
          const checked = selectedSet === null ? true : selectedSet.has(s.id);
          return (
            <label
              key={s.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-accent"
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(e) => toggle(s.id, e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <span className="text-base text-foreground">
                {s.code ? `${s.code} — ` : ""}
                {s.name}
              </span>
            </label>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-subtle">
        Bu tanlov Playbook va qo'ng'iroq analizlariga ta'sir qilmaydi. Barcha mezonlar
        qo'ng'iroqlarni baholashda faol qoladi.
      </p>
    </div>
  );
}

function MiniAppAudioRules() {
  const { user } = useAuth();
  const { data: rules } = useMiniAppAudioRules();
  const createRule = useCreateMiniAppAudioRule();
  const deleteRule = useDeleteMiniAppAudioRule();
  const { names: funnelNames } = useFunnelNames();
  const { data: stages } = usePipelineStagesRaw();

  const [funnel, setFunnel] = useState("");
  const [stageIds, setStageIds] = useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const stageById = new Map((stages ?? []).map((s) => [s.id, s.name]));

  function toggleStage(id: string, checked: boolean) {
    setStageIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  async function addRule() {
    if (!funnel || stageIds.length === 0) return;
    try {
      await createRule.mutateAsync({
        organization_id: user!.organizationId!,
        funnel,
        stage_ids: stageIds,
        position: rules?.length ?? 0,
      });
      setFunnel("");
      setStageIds([]);
    } catch (err) {
      toast.error(errorMessage(err, "Qoida qo'shishda xatolik yuz berdi."));
    }
  }

  async function removeRule(id: string) {
    try {
      await deleteRule.mutateAsync(id);
    } catch (err) {
      toast.error(errorMessage(err, "Qoidani o'chirishda xatolik yuz berdi."));
    } finally {
      setConfirmDeleteId(null);
    }
  }

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-border bg-background p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-muted-foreground">Voronka tanlang</span>
          <select
            value={funnel}
            onChange={(e) => setFunnel(e.target.value)}
            className="mt-1.5 h-11 w-full rounded-xl border border-border bg-accent px-3 text-sm outline-none focus:border-primary/40"
          >
            <option value="">Voronkani tanlang</option>
            {funnelNames.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <div>
          <span className="text-sm font-medium text-muted-foreground">Bosqichlarni tanlang</span>
          <div className="mt-1.5 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border bg-accent p-2">
            {(stages ?? []).length === 0 && (
              <p className="px-2 py-1 text-sm text-subtle">Bosqichlarni tanlang</p>
            )}
            {(stages ?? []).map((s) => (
              <label
                key={s.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={stageIds.includes(s.id)}
                  onChange={(e) => toggleStage(s.id, e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <span className="text-base text-foreground">{s.name}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void addRule()}
        disabled={createRule.isPending || !funnel || stageIds.length === 0}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-dashed border-border px-4 text-sm font-semibold text-subtle transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        {createRule.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        Qo'shish
      </button>

      {(rules ?? []).map((rule) => (
        <div
          key={rule.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-accent px-4 py-3"
        >
          <div>
            <p className="text-base font-semibold text-foreground">{rule.funnel}</p>
            <p className="text-sm text-subtle">
              {rule.stage_ids.map((id) => stageById.get(id) ?? "?").join(" | ")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmDeleteId(rule.id)}
            className="shrink-0 rounded-lg p-2 text-subtle transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label="O'chirish"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(o) => !o && setConfirmDeleteId(null)}
        title="Qoidani o'chirish"
        description="Ushbu voronka/bosqich qoidasi Mini App audio ko'rib chiqishdan olib tashlanadi."
        onConfirm={() => confirmDeleteId && void removeRule(confirmDeleteId)}
      />
    </div>
  );
}

function DailyReportSettingsPage() {
  const { data: settings, isLoading } = useDailyReportSettings();
  const updateSettings = useUpdateDailyReportSettings();

  const [hydrated, setHydrated] = useState(false);
  const [sendEnabled, setSendEnabled] = useState(true);
  const [sendTime, setSendTime] = useState("23:50");
  const [reportLanguage, setReportLanguage] = useState("uz");
  const [taskDueReminderEnabled, setTaskDueReminderEnabled] = useState(true);
  const [taskDueReminderMinutes, setTaskDueReminderMinutes] = useState("5");
  const [morningSummaryEnabled, setMorningSummaryEnabled] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [managerConversionEnabled, setManagerConversionEnabled] = useState(false);
  const [managerConversionCriterionIds, setManagerConversionCriterionIds] = useState<
    string[] | null
  >(null);
  const [callAudioMiniAppEnabled, setCallAudioMiniAppEnabled] = useState(false);

  useEffect(() => {
    if (!settings || hydrated) return;
    setSendEnabled(settings.send_enabled);
    setSendTime(settings.send_time.slice(0, 5));
    setReportLanguage(settings.report_language);
    setTaskDueReminderEnabled(settings.task_due_reminder_enabled);
    setTaskDueReminderMinutes(String(settings.task_due_reminder_minutes_before));
    setMorningSummaryEnabled(settings.morning_summary_enabled);
    setManagerConversionEnabled(settings.manager_conversion_recommendations_enabled);
    setManagerConversionCriterionIds(settings.manager_conversion_recommendation_criterion_ids);
    setCallAudioMiniAppEnabled(settings.call_audio_mini_app_enabled);
    setHydrated(true);
  }, [settings, hydrated]);

  async function save() {
    const minutes = Math.min(5, Math.max(2, Number(taskDueReminderMinutes) || 5));
    try {
      await updateSettings.mutateAsync({
        send_enabled: sendEnabled,
        send_time: `${sendTime}:00`,
        report_language: reportLanguage,
        task_due_reminder_enabled: taskDueReminderEnabled,
        task_due_reminder_minutes_before: minutes,
        morning_summary_enabled: morningSummaryEnabled,
        manager_conversion_recommendations_enabled: managerConversionEnabled,
        manager_conversion_recommendation_criterion_ids: managerConversionCriterionIds,
        call_audio_mini_app_enabled: callAudioMiniAppEnabled,
      });
      toast.success("Sozlamalar saqlandi.");
    } catch (err) {
      toast.error(errorMessage(err, "Saqlashda xatolik yuz berdi."));
    }
  }

  return (
    <>
      <Link
        to="/settings"
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-subtle transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Sozlamalar bo'limiga qaytish
      </Link>
      <PageHeader
        title="Kunlik hisobot sozlamalari"
        description="Har kuni avtomatik hisobot yuborishni sozlang."
      />

      {isLoading && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda...
        </div>
      )}

      <div className="grid gap-6">
        <SectionCard>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <Sparkles className="h-4 w-4" />
            </span>
            <h3 className="text-base font-semibold text-foreground">Yuborish va til</h3>
          </div>

          <div className="mt-4 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-muted-foreground">Holat</span>
              <div className="flex items-center gap-2.5">
                <Switch
                  checked={sendEnabled}
                  disabled={updateSettings.isPending}
                  onCheckedChange={setSendEnabled}
                />
                <span className="text-sm text-muted-foreground">
                  {sendEnabled ? "Yoqilgan" : "O'chirilgan"}
                </span>
              </div>
            </div>

            <label className="block max-w-xs">
              <span className="text-sm font-medium text-muted-foreground">Yuborish vaqti</span>
              <input
                type="time"
                value={sendTime}
                onChange={(e) => setSendTime(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-border bg-accent px-3 text-sm outline-none focus:border-primary/40"
              />
            </label>

            <label className="block max-w-xs">
              <span className="text-sm font-medium text-muted-foreground">Hisobot tili</span>
              <select
                value={reportLanguage}
                onChange={(e) => setReportLanguage(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-border bg-accent px-3 text-sm outline-none focus:border-primary/40"
              >
                {LANGUAGE_OPTIONS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
              <span className="mt-1.5 block text-sm text-subtle">
                Kunlik hisobot va Telegram xabari shu tilda yuboriladi. Odatiy holatda biznes tili
                ishlatiladi.
              </span>
            </label>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
              <Bell className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Telegram vazifa bildirishnomalari
              </h3>
              <p className="text-sm text-subtle">
                Faqat Telegram botiga ulangan sotuv menejerlariga shaxsiy xabar yuboradi. Bu
                sozlamalar yuqoridagi kunlik hisobotdan mustaqil.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <ToggleRow
              title="Vazifa muddati eslatmalari"
              description="Kontakt, vazifa va oldingi tegishli qo'ng'iroq xulosasini Qo'ng'iroq qilish va Bajarildi amallari bilan yuboradi. Qo'ng'iroq qilish amali shaxsiy chatga Telegram kontakt kartasini yuboradi."
              enabled={taskDueReminderEnabled}
              disabled={updateSettings.isPending}
              onToggle={setTaskDueReminderEnabled}
            >
              <div className="mt-3 max-w-xs">
                <span className="text-sm font-medium text-muted-foreground">
                  Muddatdan necha daqiqa oldin
                </span>
                <input
                  type="number"
                  min={2}
                  max={5}
                  value={taskDueReminderMinutes}
                  onChange={(e) => setTaskDueReminderMinutes(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-border bg-accent px-3 text-sm outline-none focus:border-primary/40"
                />
                <span className="mt-1.5 block text-sm text-subtle">
                  2 dan 5 gacha butun son tanlang. 2 daqiqalik variant kechikmasligi uchun bir
                  daqiqagacha ertaroq kelishi mumkin.
                </span>
              </div>
            </ToggleRow>

            <div className="border-t border-border pt-4">
              <ToggleRow
                title="Ertalabki vazifalar qisqacha hisoboti"
                description="Har bir ish kuni lidlar va vazifalar soni hamda eng yaqin beshta ochiq vazifani yuboradi."
                enabled={morningSummaryEnabled}
                disabled={updateSettings.isPending}
                onToggle={setMorningSummaryEnabled}
              >
                <p className="mt-3 rounded-xl bg-muted/50 px-4 py-3 text-sm text-subtle">
                  Menejerning ish kuni boshlanishidan 5 daqiqa oldin yuboriladi. Shaxsiy menejer
                  jadvali yoqilgan bo'lsa, menejerning boshlanish vaqti; aks holda biznesning
                  boshlanish vaqti ishlatiladi.
                </p>
              </ToggleRow>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          actions={
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
            >
              {advancedOpen ? "Kengaytirilgan sozlamalarni yopish" : "Kengaytirilgan sozlamalar"}
              {advancedOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          }
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <FileText className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-foreground">Kengaytirilgan sozlamalar</h3>
              <p className="text-sm text-subtle">
                Kunlik hisobotni yanada batafsil boshqarish uchun qo'shimcha sozlamalar.
              </p>
            </div>
          </div>

          {advancedOpen && (
            <div className="mt-4 space-y-4">
              <div className="border-t border-border pt-4">
                <ToggleRow
                  title="Menejer konversiyasini oshirish bo'yicha tavsiyalar"
                  description="Yoqilganda, rahbarning kunlik hisobotiga har bir menejerning barcha sotuvlari bo'yicha lid konversiyasi, barcha tahlil qilingan qo'ng'iroqlaridan aniqlangan haqiqiy muammolar va menejerlarning jami umumiy konversiyasi qo'shiladi. Odatiy holatda o'chirilgan. Sozlama faqat joriy biznesga qo'llanadi."
                  enabled={managerConversionEnabled}
                  disabled={updateSettings.isPending}
                  onToggle={setManagerConversionEnabled}
                >
                  {managerConversionEnabled && (
                    <ManagerConversionCriteria
                      criterionIds={managerConversionCriterionIds}
                      onChange={setManagerConversionCriterionIds}
                      disabled={updateSettings.isPending}
                    />
                  )}
                </ToggleRow>
              </div>

              <div className="border-t border-border pt-4">
                <ToggleRow
                  title="Qo'ng'iroq audiolarini Telegram Mini App'da ko'rib chiqish"
                  description="Tanlangan CRM voronka va bosqichlariga mos qo'ng'iroqlar uchun rahbarning kunlik Telegram hisobotida har bir menejerga alohida ko'k Mini App havolasi chiqadi. Har bir havolada shu hisobot kunidagi eng so'nggi 5 tagacha yaroqli audio Mini App ichida tinglanadi. Odatiy holatda o'chirilgan."
                  enabled={callAudioMiniAppEnabled}
                  disabled={updateSettings.isPending}
                  onToggle={setCallAudioMiniAppEnabled}
                >
                  {callAudioMiniAppEnabled && <MiniAppAudioRules />}
                </ToggleRow>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard
          actions={
            <Link
              to="/daily-report-settings/sections"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Hisobot tarkibini sozlash →
            </Link>
          }
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <FileText className="h-4 w-4" />
            </span>
            <h3 className="text-base font-semibold text-foreground">Hisobot tarkibi sozlamalari</h3>
          </div>
          <p className="mt-3 text-sm text-subtle">
            Yuborish sozlamalarini band qilmasdan, hisobot qismlari, kiritiladigan menejerlar, CRM
            voronkalari, lid sifati guruhlari, anketa javoblari va bosqich o'tishlarini alohida
            ekranda tanlang.
          </p>
        </SectionCard>

        <div>
          <button
            type="button"
            onClick={() => void save()}
            disabled={updateSettings.isPending}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {updateSettings.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Saqlash
          </button>
        </div>
      </div>
    </>
  );
}
