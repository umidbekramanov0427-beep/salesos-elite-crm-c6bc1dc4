import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bot, Loader2, MessageSquare, Phone, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionCard, Pill } from "@/components/layout/Primitives";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useAiAgents, useUpdateAiAgent, type AiAgentRow } from "@/hooks/use-crm-data";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/ai-agents")({
  head: () => ({
    meta: [
      { title: "AI agentlar — SalesOS Elite" },
      { name: "description", content: "Admin-only AI agent configuration for chats and calls." },
    ],
  }),
  component: AiAgentsPage,
});

const MODELS = ["deepseek-chat", "deepseek-reasoner"] as const;
const MODEL_LABEL: Record<(typeof MODELS)[number], string> = {
  "deepseek-chat": "DeepSeek Chat",
  "deepseek-reasoner": "DeepSeek Reasoner",
};
const MODEL_HINT: Record<(typeof MODELS)[number], string> = {
  "deepseek-chat": "Tavsiya etiladi — tez va sifatli javoblar uchun",
  "deepseek-reasoner": "Chuqurroq mulohaza yuritadi, murakkab tahlil uchun (sekinroq)",
};

const CHANNELS = ["telegram_bot", "telegram", "whatsapp", "instagram"] as const;
const CHANNEL_LABEL: Record<(typeof CHANNELS)[number], string> = {
  telegram_bot: "Telegram Bot",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
};

type Kind = "chat" | "call";

const DEFAULTS: Record<Kind, { icon: typeof MessageSquare; promptKey: string }> = {
  chat: { icon: MessageSquare, promptKey: "admin.ai.chatDefaultPrompt" },
  call: { icon: Phone, promptKey: "admin.ai.callDefaultPrompt" },
};

function ConfigDialog({
  kind,
  agent,
  open,
  onOpenChange,
}: {
  kind: Kind;
  agent: AiAgentRow | undefined;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useI18n();
  const updateAgent = useUpdateAiAgent();
  const [model, setModel] = useState<string>("deepseek-chat");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setModel(agent?.model ?? "deepseek-chat");
    setSystemPrompt(agent?.system_prompt ?? t(DEFAULTS[kind].promptKey));
    setChannels(agent?.channels ?? []);
  }, [open, agent, kind, t]);

  function toggleChannel(c: string) {
    setChannels((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateAgent.mutateAsync({
        kind,
        model,
        system_prompt: systemPrompt.trim(),
        channels: kind === "chat" ? channels : [],
        active: agent?.active ?? true,
      });
      toast.success(t("admin.ai.saved"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.ai.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            {kind === "chat" ? t("admin.ai.chatTitle") : t("admin.ai.callTitle")}
          </DialogTitle>
          <DialogDescription>{t("admin.ai.formDesc")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <span className="text-[13px] font-medium text-muted-foreground">
              {t("admin.ai.model")}
            </span>
            <div className="mt-1.5 space-y-1.5">
              {MODELS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModel(m)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                    model === m
                      ? "border-primary/40 bg-primary/10"
                      : "border-border hover:bg-accent",
                  )}
                >
                  <span>
                    <span className="font-medium text-foreground">{MODEL_LABEL[m]}</span>
                    <span className="block text-[11px] text-subtle">{MODEL_HINT[m]}</span>
                  </span>
                  {model === m && <Pill tone="info">{t("admin.ai.selected")}</Pill>}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-[13px] font-medium text-muted-foreground">
              {t("admin.ai.systemPrompt")}
            </span>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={5}
              className="mt-1.5 w-full resize-none rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary/40"
            />
          </label>

          {kind === "chat" && (
            <div>
              <span className="text-[13px] font-medium text-muted-foreground">
                {t("admin.ar.channels")}
              </span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {CHANNELS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleChannel(c)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                      channels.includes(c)
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {CHANNEL_LABEL[c]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("common.save")}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AgentCard({ kind, agent }: { kind: Kind; agent: AiAgentRow | undefined }) {
  const { t } = useI18n();
  const updateAgent = useUpdateAiAgent();
  const [open, setOpen] = useState(false);
  const Icon = DEFAULTS[kind].icon;

  async function toggleActive() {
    try {
      await updateAgent.mutateAsync({
        kind,
        active: !(agent?.active ?? false),
        model: agent?.model ?? undefined,
        system_prompt: agent?.system_prompt ?? undefined,
        channels: agent?.channels,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.ai.saveFailed"));
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={agent?.active ?? false}
          onClick={() => void toggleActive()}
          className={cn(
            "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors",
            agent?.active ? "bg-primary" : "bg-muted",
          )}
        >
          <span
            className={cn(
              "absolute left-1 h-5 w-5 rounded-full bg-background shadow-soft transition-transform duration-200",
              agent?.active && "translate-x-5",
            )}
          />
        </button>
      </div>

      <h3 className="mt-4 text-sm font-semibold text-foreground">
        {kind === "chat" ? t("admin.ai.chatTitle") : t("admin.ai.callTitle")}
      </h3>
      <p className="mt-1.5 text-xs text-subtle">
        {kind === "chat" ? t("admin.ai.chatDesc") : t("admin.ai.callDesc")}
      </p>

      {agent && (
        <p className="mt-3 text-[11px] text-subtle">
          {t("admin.ai.model")}: <span className="font-medium text-foreground">{agent.model}</span>
        </p>
      )}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-xl border border-border bg-background text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent"
      >
        {t("admin.ai.configure")}
      </button>

      <ConfigDialog kind={kind} agent={agent} open={open} onOpenChange={setOpen} />
    </div>
  );
}

function AiAgentsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { data: agents, isLoading } = useAiAgents();

  if (user && user.role !== "super_admin") {
    return (
      <SectionCard title={t("admin.restrictedTitle")} description={t("admin.restrictedDesc")}>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <ShieldAlert className="h-4 w-4" /> {t("admin.restrictedHint")}
        </div>
      </SectionCard>
    );
  }

  const chatAgent = agents?.find((a) => a.kind === "chat");
  const callAgent = agents?.find((a) => a.kind === "call");

  return (
    <>
      <PageHeader title={t("admin.aiAgents")} description={t("admin.aiAgentsDesc")} />

      <p className="mb-6 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
        {t("admin.ai.notice")}
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <AgentCard kind="chat" agent={chatAgent} />
          <AgentCard kind="call" agent={callAgent} />
        </div>
      )}
    </>
  );
}
