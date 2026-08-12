import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useI18n, type Lang } from "@/lib/i18n";
import { useAiAssistantChat } from "@/hooks/use-crm-data";
import { cn } from "@/lib/utils";

const LANG_NAME: Record<Lang, string> = { uz: "o'zbek", ru: "русский", en: "English" };

type FieldKey = "company_name" | "description" | "competitors" | "terminology" | "tone";

const FIELD_ORDER: FieldKey[] = [
  "company_name",
  "description",
  "competitors",
  "terminology",
  "tone",
];

function fieldAt(index: number): FieldKey {
  return FIELD_ORDER[index] ?? "tone";
}

type ChatMsg = { role: "bot" | "user"; text: string };

export function BusinessProfileBot({
  onComplete,
  onClose,
}: {
  onComplete: (fields: Partial<Record<FieldKey, string>>) => void;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const chat = useAiAssistantChat();

  const questions: Record<FieldKey, string> = {
    company_name: t("bizbot.q.companyName"),
    description: t("bizbot.q.description"),
    competitors: t("bizbot.q.competitors"),
    terminology: t("bizbot.q.terminology"),
    tone: t("bizbot.q.tone"),
  };

  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "bot", text: questions[fieldAt(0)] },
  ]);
  const [answers, setAnswers] = useState<Partial<Record<FieldKey, string>>>({});
  const [step, setStep] = useState(0);
  const [input, setInput] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [done, setDone] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, finishing]);

  async function finish(allAnswers: Partial<Record<FieldKey, string>>) {
    setFinishing(true);
    try {
      const transcript = FIELD_ORDER.map(
        (k) => `Q: ${questions[k]}\nA: ${allAnswers[k] ?? ""}`,
      ).join("\n\n");
      const reply = await chat.mutateAsync({
        messages: [
          {
            role: "user",
            content: `Below is a Q&A interview with a business owner filling out their CRM's business profile. Extract and clean up the answers into a strict JSON object with exactly these keys: company_name, description, competitors, terminology, tone. Each value must be a well-written string in ${LANG_NAME[lang]} based only on what the user actually said — don't invent facts they didn't mention. If the user gave no real answer for a field, use an empty string "" for it. Respond with ONLY the raw JSON object — no markdown fences, no extra commentary.\n\n${transcript}`,
          },
        ],
      });
      let parsed: Partial<Record<FieldKey, string>> = {};
      try {
        const cleaned = reply
          .trim()
          .replace(/^```(?:json)?/i, "")
          .replace(/```$/, "")
          .trim();
        const obj = JSON.parse(cleaned) as Record<string, unknown>;
        parsed = {};
        for (const k of FIELD_ORDER) {
          if (typeof obj[k] === "string" && obj[k]) parsed[k] = obj[k] as string;
        }
      } catch {
        parsed = {};
      }
      const finalFields: Partial<Record<FieldKey, string>> = {};
      for (const k of FIELD_ORDER) {
        finalFields[k] = parsed[k]?.trim() || allAnswers[k]?.trim() || "";
      }
      setMessages((m) => [...m, { role: "bot", text: t("bizbot.done") }]);
      setDone(true);
      onComplete(finalFields);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("bizbot.extractFailed"));
      onComplete(allAnswers);
      setMessages((m) => [...m, { role: "bot", text: t("bizbot.done") }]);
      setDone(true);
    } finally {
      setFinishing(false);
    }
  }

  function send() {
    const text = input.trim();
    if (!text || done || finishing) return;
    const key = fieldAt(step);
    const nextAnswers = { ...answers, [key]: text };
    setAnswers(nextAnswers);
    setInput("");
    const nextStep = step + 1;
    if (nextStep < FIELD_ORDER.length) {
      setMessages((m) => [
        ...m,
        { role: "user", text },
        { role: "bot", text: questions[fieldAt(nextStep)] },
      ]);
      setStep(nextStep);
    } else {
      setMessages((m) => [...m, { role: "user", text }]);
      setStep(nextStep);
      void finish(nextAnswers);
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Bot className="h-4 w-4 text-primary" /> {t("bizbot.title")}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-subtle transition-colors hover:text-foreground"
          aria-label={t("common.close")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl bg-background p-3">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <p
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm",
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface text-foreground",
              )}
            >
              {m.text}
            </p>
          </div>
        ))}
        {finishing && (
          <div className="flex items-center gap-2 text-xs text-subtle">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("bizbot.thinking")}
          </div>
        )}
        <div ref={endRef} />
      </div>
      {!done ? (
        <div className="mt-3 flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                send();
              }
            }}
            disabled={finishing}
            placeholder={t("bizbot.answerPlaceholder")}
            className="h-10 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          <button
            type="button"
            onClick={send}
            disabled={finishing || !input.trim()}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <p className="mt-3 flex items-center gap-2 text-xs font-medium text-success">
          <Sparkles className="h-3.5 w-3.5" /> {t("bizbot.filledHint")}
        </p>
      )}
    </div>
  );
}
