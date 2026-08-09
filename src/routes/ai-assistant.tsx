import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  Clock,
  Flame,
  Lightbulb,
  Loader2,
  MessageSquare,
  Phone,
  Send,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/components/layout/Primitives";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useAiAssistantChat } from "@/hooks/use-crm-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ai-assistant")({
  head: () => ({
    meta: [
      { title: "AI Assistant — SalesOS Elite" },
      {
        name: "description",
        content: "Ask the AI assistant about your leads, deals and pipeline.",
      },
    ],
  }),
  component: AiAssistantPage,
});

type Msg = { role: "user" | "assistant"; content: string; error?: boolean };

const PROMPT_STYLE = [
  { icon: TrendingUp, tone: "bg-primary/10 text-primary" },
  { icon: AlertTriangle, tone: "bg-destructive/10 text-destructive" },
  { icon: Phone, tone: "bg-success/10 text-success" },
  { icon: TrendingDown, tone: "bg-warning/15 text-warning-foreground" },
  { icon: Flame, tone: "bg-orange-500/10 text-orange-500" },
  { icon: Lightbulb, tone: "bg-violet-500/10 text-violet-500" },
  { icon: Clock, tone: "bg-cyan-500/10 text-cyan-600" },
  { icon: MessageSquare, tone: "bg-teal-500/10 text-teal-600" },
] as const;

function SuggestionCard({
  icon: Icon,
  tone,
  label,
  onClick,
}: {
  icon: typeof TrendingUp;
  tone: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card"
    >
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tone)}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="text-[15px] font-semibold text-foreground">{label}</span>
    </button>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const firstName = (user?.name ?? "").split(" ")[0] || t("ai.friend");

  return (
    <div className="flex flex-1 flex-col items-center overflow-y-auto px-6 pb-10 pt-8 text-center">
      <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-foreground text-background shadow-elevated">
        <Sparkles className="h-7 w-7" />
      </span>
      <h2 className="text-3xl font-bold tracking-tight text-foreground">
        {t("ai.greeting", { name: firstName })}
      </h2>
      <p className="mt-2.5 text-base text-muted-foreground">{t("ai.subtitle")}</p>
      <div className="mt-8 grid w-full max-w-3xl gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function AiAssistantPage() {
  const { t } = useI18n();
  const chat = useAiAssistantChat();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");

  const prompts = [
    t("ai.prompt1"),
    t("ai.prompt2"),
    t("ai.prompt3"),
    t("ai.prompt4"),
    t("ai.prompt5"),
    t("ai.prompt6"),
    t("ai.prompt7"),
    t("ai.prompt8"),
  ];

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || chat.isPending) return;
    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");
    try {
      const reply = await chat.mutateAsync(next);
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: err instanceof Error ? err.message : t("ai.genericError"),
          error: true,
        },
      ]);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  return (
    <>
      <PageHeader title={t("nav.aiAssistant")} description={t("ai.subtitle")} />

      <section className="surface-card flex h-[75vh] flex-col overflow-hidden">
        {messages.length === 0 ? (
          <EmptyState>
            {prompts.map((p, i) => {
              const style = PROMPT_STYLE[i % PROMPT_STYLE.length]!;
              return (
                <SuggestionCard
                  key={p}
                  icon={style.icon}
                  tone={style.tone}
                  label={p}
                  onClick={() => void send(p)}
                />
              );
            })}
          </EmptyState>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[70%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px]",
                  m.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : m.error
                      ? "border border-destructive/30 bg-destructive/10 text-destructive"
                      : "bg-surface text-foreground",
                )}
              >
                {m.content}
              </div>
            ))}

            {chat.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
              </div>
            )}
          </div>
        )}

        <div className="border-t border-border p-5">
          <form onSubmit={onSubmit} className="flex items-center gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("ai.placeholder")}
              className="h-14 flex-1 rounded-full border border-border bg-surface px-6 text-base outline-none transition-colors focus:border-primary/50"
            />
            <button
              type="submit"
              disabled={chat.isPending || !input.trim()}
              aria-label={t("ai.send")}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <Send className="h-5 w-5" />
            </button>
          </form>
          <p className="mt-2.5 text-center text-[11px] text-subtle">{t("ai.disclaimer")}</p>
        </div>
      </section>
    </>
  );
}
