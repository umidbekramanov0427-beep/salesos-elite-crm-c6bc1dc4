import type { HrCandidateStatus } from "@/hooks/use-crm-data";

export const HR_STATUS_META: Record<
  HrCandidateStatus,
  { label: string; tone: "neutral" | "success" | "danger" | "warning" | "info" }
> = {
  yangi: { label: "Yangi", tone: "info" },
  korib_chiqilmoqda: { label: "Ko'rib chiqilmoqda", tone: "warning" },
  band_qilindi: { label: "Band qilindi", tone: "success" },
  rad_etildi: { label: "Rad etildi", tone: "danger" },
};
