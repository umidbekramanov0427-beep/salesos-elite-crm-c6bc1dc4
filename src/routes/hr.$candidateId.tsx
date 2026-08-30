import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Clock, Loader2, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionCard, Pill } from "@/components/layout/Primitives";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HR_STATUS_META } from "@/lib/hr-status";
import {
  useHrCandidateDetail,
  useUpdateHrCandidateStatus,
  HR_CANDIDATE_STATUSES,
  type HrCandidateStatus,
} from "@/hooks/use-crm-data";

export const Route = createFileRoute("/hr/$candidateId")({
  head: () => ({
    meta: [{ title: "Nomzod — Kadrlar bo'limi — SalesOS Elite" }],
  }),
  component: HrCandidateDetailPage,
});

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
    return err.message || fallback;
  }
  return fallback;
}

function ChangeStatusDialog({
  candidateId,
  currentStatus,
}: {
  candidateId: string;
  currentStatus: string;
}) {
  const updateStatus = useUpdateHrCandidateStatus();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<HrCandidateStatus>(currentStatus as HrCandidateStatus);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await updateStatus.mutateAsync({ candidateId, status, reason: reason.trim() });
      toast.success("Holat yangilandi.");
      setReason("");
      setOpen(false);
    } catch (err) {
      toast.error(errorMessage(err, "Holatni yangilab bo'lmadi."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setStatus(currentStatus as HrCandidateStatus);
          setReason("");
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Holatni o'zgartirish
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Holatni o'zgartirish</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>Yangi holat</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as HrCandidateStatus)}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HR_CANDIDATE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {HR_STATUS_META[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="hr-status-reason">Sababi (majburiy)</Label>
            <Textarea
              id="hr-status-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nima uchun bu holat qo'yilyapti, aniq yozing..."
              className="mt-1.5"
              rows={4}
              required
            />
          </div>
          <DialogFooter>
            <button
              type="submit"
              disabled={busy || !reason.trim()}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Saqlash
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function HrCandidateDetailPage() {
  const { candidateId } = Route.useParams();
  const { data, isLoading, error } = useHrCandidateDetail(candidateId);

  return (
    <>
      <Link
        to="/hr"
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-subtle transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Kadrlar bo'limiga qaytish
      </Link>

      {isLoading && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda...
        </div>
      )}
      {error && (
        <p className="py-6 text-sm text-destructive">
          {error instanceof Error ? error.message : String(error)}
        </p>
      )}

      {data && (
        <>
          <PageHeader
            title={
              data.candidate.telegram_username
                ? `@${data.candidate.telegram_username}`
                : `Chat #${data.candidate.telegram_chat_id}`
            }
            description={`Vakansiya: ${data.candidate.hr_vacancies?.title ?? "—"} · Murojaat: ${fmtDate(data.candidate.created_at)}`}
            actions={
              <div className="flex items-center gap-3">
                <Pill
                  tone={
                    HR_STATUS_META[data.candidate.status as HrCandidateStatus]?.tone ?? "neutral"
                  }
                >
                  {HR_STATUS_META[data.candidate.status as HrCandidateStatus]?.label ??
                    data.candidate.status}
                </Pill>
                <ChangeStatusDialog
                  candidateId={data.candidate.id}
                  currentStatus={data.candidate.status}
                />
              </div>
            }
          />

          <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
            <SectionCard title="Savollar va javoblar">
              {data.answers.length === 0 ? (
                <p className="py-4 text-sm text-subtle">
                  {data.candidate.completed_at
                    ? "Javoblar topilmadi."
                    : "Nomzod hali savollarga javob berishni yakunlamagan."}
                </p>
              ) : (
                <div className="space-y-4">
                  {data.answers.map((a, i) => (
                    <div key={a.id} className="rounded-xl bg-accent p-4">
                      <p className="flex items-start gap-2 text-sm font-semibold text-foreground">
                        <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        {i + 1}. {a.hr_questions?.question ?? "Savol o'chirilgan"}
                      </p>
                      <p className="mt-2 pl-6 text-sm text-muted-foreground">{a.answer_text}</p>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Holat tarixi" description="Har bir o'zgarish sababi bilan birga.">
              {data.history.length === 0 ? (
                <p className="py-4 text-sm text-subtle">Hali holat o'zgartirilmagan.</p>
              ) : (
                <div className="space-y-4">
                  {data.history.map((h) => (
                    <div key={h.id} className="border-l-2 border-border pl-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill
                          tone={HR_STATUS_META[h.status as HrCandidateStatus]?.tone ?? "neutral"}
                        >
                          {HR_STATUS_META[h.status as HrCandidateStatus]?.label ?? h.status}
                        </Pill>
                        <span className="flex items-center gap-1 text-xs text-subtle">
                          <Clock className="h-3 w-3" /> {fmtDate(h.created_at)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm text-foreground">{h.reason}</p>
                      <p className="mt-1 text-xs text-subtle">
                        {h.profiles?.full_name || h.profiles?.email || "Noma'lum"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </>
      )}
    </>
  );
}
