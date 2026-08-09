import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/Primitives";
import { useI18n } from "@/lib/i18n";
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

function AiAssistantPage() {
  const { t } = useI18n();
  const chat = useAiAssistantChat();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");

  const prompts = [t("ai.prompt1"), t("ai.prompt2"), t("ai.prompt3"), t("ai.prompt4")];

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

      <section className="surface-card flex h-[70vh] flex-col overflow-hidden">
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-subtle">
                <Sparkles className="h-3.5 w-3.5" /> {t("ai.tryAsking")}
              </p>
              {prompts.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => void send(p)}
                  className="block w-full rounded-xl border border-border px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[70%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
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

        <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-border p-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("ai.placeholder")}
            className="h-11 flex-1 rounded-xl border border-border bg-surface px-4 text-sm outline-none transition-colors focus:border-primary/50"
          />
          <button
            type="submit"
            disabled={chat.isPending || !input.trim()}
            aria-label={t("ai.send")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </section>
    </>
  );
}
