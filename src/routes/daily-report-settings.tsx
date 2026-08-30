import { useEffect, useState } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, Bell, FileText, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionCard } from "@/components/layout/Primitives";
import { Switch } from "@/components/ui/switch";
import { useDailyReportSettings, useUpdateDailyReportSettings } from "@/hooks/use-crm-data";

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

function DailyReportSettingsPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: settings, isLoading } = useDailyReportSettings();
  const updateSettings = useUpdateDailyReportSettings();

  const [hydrated, setHydrated] = useState(false);
  const [sendEnabled, setSendEnabled] = useState(true);
  const [sendTime, setSendTime] = useState("23:50");
  const [reportLanguage, setReportLanguage] = useState("uz");
  const [taskDueReminderEnabled, setTaskDueReminderEnabled] = useState(true);
  const [taskDueReminderMinutes, setTaskDueReminderMinutes] = useState("5");
  const [morningSummaryEnabled, setMorningSummaryEnabled] = useState(true);

  useEffect(() => {
    if (!settings || hydrated) return;
    setSendEnabled(settings.send_enabled);
    setSendTime(settings.send_time.slice(0, 5));
    setReportLanguage(settings.report_language);
    setTaskDueReminderEnabled(settings.task_due_reminder_enabled);
    setTaskDueReminderMinutes(String(settings.task_due_reminder_minutes_before));
    setMorningSummaryEnabled(settings.morning_summary_enabled);
    setHydrated(true);
  }, [settings, hydrated]);

  // "/daily-report-settings/sections" is a child route (daily-report-
  // settings.sections.tsx) -- this file is its layout, so it has to yield
  // via Outlet on that path instead of always rendering its own landing-
  // page content, or the child route's page silently never appears no
  // matter what the URL says (see admin.tsx for the same pattern). This
  // check has to come after every hook above so hook order stays fixed
  // across renders regardless of which path we're on.
  if (pathname !== "/daily-report-settings") {
    return <Outlet />;
  }

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
            voronkalari, lid sifati guruhlari, anketa javoblari, bosqich o'tishlari va
            kengaytirilgan sozlamalarni alohida ekranda tanlang.
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
