import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  Clock,
  Flame,
  Lightbulb,
  Loader2,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  Phone,
  Plus,
  Search,
  Send,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/components/layout/Primitives";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import {
  useAiAssistantChat,
  useAiConversationMessages,
  useAiConversations,
  useCreateAiConversation,
  useSaveAiMessage,
  type AiChatConversationRow,
} from "@/hooks/use-crm-data";
import { cn } from "@/lib/utils";
import { PermissionGate } from "@/components/PermissionGate";

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
  component: AiAssistantPageGated,
});

function AiAssistantPageGated() {
  return (
    <PermissionGate action="Use AI assistant">
      <AiAssistantPage />
    </PermissionGate>
  );
}

type Msg = { role: "user" | "assistant"; content: string; error?: boolean };

const PROMPT_STYLE = [
  { icon: TrendingUp, tone: "bg-primary/10 text-primary", rail: "border-l-primary" },
  { icon: AlertTriangle, tone: "bg-destructive/10 text-destructive", rail: "border-l-destructive" },
  { icon: Phone, tone: "bg-success/10 text-success", rail: "border-l-success" },
  {
    icon: TrendingDown,
    tone: "bg-warning/15 text-warning-foreground",
    rail: "border-l-warning",
  },
  { icon: Flame, tone: "bg-orange-500/10 text-orange-500", rail: "border-l-orange-500" },
  { icon: Lightbulb, tone: "bg-violet-500/10 text-violet-500", rail: "border-l-violet-500" },
  { icon: Clock, tone: "bg-cyan-500/10 text-cyan-600", rail: "border-l-cyan-500" },
  { icon: MessageSquare, tone: "bg-teal-500/10 text-teal-600", rail: "border-l-teal-500" },
] as const;

function SuggestionCard({
  icon: Icon,
  tone,
  rail,
  label,
  onClick,
}: {
  icon: typeof TrendingUp;
  tone: string;
  rail: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-l-[3px] border-border bg-card px-4 py-3.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-card",
        rail,
      )}
    >
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", tone)}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-[14px] font-semibold text-foreground">{label}</span>
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

function dateLabel(iso: string, lang: string, t: (k: string) => string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, now)) return t("lb.presetToday");
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return t("lb.presetYesterday");
  return d.toLocaleDateString(lang, { day: "numeric", month: "short" });
}

function HistoryPanel({
  conversations,
  activeId,
  onSelect,
  onNew,
  onClose,
}: {
  conversations: AiChatConversationRow[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? conversations.filter((c) => c.title.toLowerCase().includes(search.trim().toLowerCase()))
    : conversations;

  return (
    <aside className="flex w-full max-w-[300px] shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border p-4">
        <div>
          <h3 className="text-sm font-bold text-foreground">{t("ai.history")}</h3>
          <p className="text-xs text-subtle">
            {t("ai.historyCount", { count: conversations.length })}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onNew}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> {t("ai.newChat")}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("ai.closeHistory")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="border-b border-border p-3">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-subtle" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("ai.searchConversations")}
            className="w-full bg-transparent text-sm outline-none placeholder:text-subtle"
          />
        </div>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {filtered.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-subtle">
            {search.trim() ? t("ai.noSearchResults") : t("ai.noConversations")}
          </p>
        )}
        {filtered.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
              c.id === activeId
                ? "bg-primary/10 font-semibold text-primary"
                : "text-foreground hover:bg-accent",
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-subtle" />
              <span className="truncate">{c.title}</span>
            </span>
            <span className="shrink-0 text-[11px] text-subtle">
              {dateLabel(c.updated_at, lang, t)}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}

// The assistant is instructed to always include a lead's real /crm/leads/<id>
// path verbatim when it mentions that lead (see ai-assistant.chat.ts's system
// prompt) -- messages render as plain text otherwise, so without this those
// paths would just sit there as unclickable text instead of taking the user
// straight to the lead.
const LEAD_PATH_RE = /\/crm\/leads\/([a-zA-Z0-9-]+)/g;

function renderMessageContent(content: string, openLabel: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(LEAD_PATH_RE);
  let key = 0;
  while ((match = re.exec(content)) !== null) {
    if (match.index > lastIndex) nodes.push(content.slice(lastIndex, match.index));
    const leadId = match[1]!;
    nodes.push(
      <Link
        key={`lead-link-${key++}`}
        to="/crm/leads/$leadId"
        params={{ leadId }}
        className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
      >
        {openLabel}
      </Link>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) nodes.push(content.slice(lastIndex));
  return nodes;
}

function AiAssistantPage() {
  const { t } = useI18n();
  const chat = useAiAssistantChat();
  const { data: conversations = [] } = useAiConversations();
  const createConversation = useCreateAiConversation();
  const saveMessage = useSaveAiMessage();

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const conversationMessages = useAiConversationMessages(activeConversationId);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  // Covers the whole send() flow (create conversation -> save user message ->
  // ask the AI -> save its reply), not just the AI call itself -- with only
  // chat.isPending gating the spinner, a slow/hung createConversation or
  // saveMessage call left the screen showing nothing at all: the user's own
  // bubble sitting there with no spinner, no reply, no error, indistinguishable
  // from the app being broken.
  const [sending, setSending] = useState(false);

  // Loads a past conversation's messages into the chat view once they arrive
  // -- the query key includes activeConversationId, so this only ever fires
  // for the conversation currently selected, never a stale one. Skipped
  // while a send is in flight: send() just switched activeConversationId to
  // a brand-new conversation, and this query can resolve with an empty (or
  // user-message-only) row set before the in-flight saves land, which would
  // otherwise clobber the optimistic messages already on screen.
  useEffect(() => {
    if (sending) return;
    if (activeConversationId && conversationMessages.data) {
      setMessages(
        conversationMessages.data.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      );
    }
  }, [activeConversationId, conversationMessages.data, sending]);

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
    if (!trimmed || sending) return;
    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");
    setSending(true);

    try {
      let conversationId = activeConversationId;
      if (!conversationId) {
        const conv = await createConversation.mutateAsync(trimmed);
        conversationId = conv.id;
        setActiveConversationId(conversationId);
      }
      await saveMessage.mutateAsync({ conversationId, role: "user", content: trimmed });

      const reply = await chat.mutateAsync({ messages: next });
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      await saveMessage.mutateAsync({ conversationId, role: "assistant", content: reply });
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: err instanceof Error ? err.message : t("ai.genericError"),
          error: true,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  function onNewChat() {
    setActiveConversationId(null);
    setMessages([]);
  }

  return (
    <>
      <PageHeader
        title={t("nav.aiAssistant")}
        description={t("ai.liveStatus")}
        actions={
          !historyOpen && (
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              aria-label={t("ai.toggleHistory")}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface text-muted-foreground transition-colors hover:bg-accent"
            >
              <PanelRightOpen className="h-4 w-4" />
            </button>
          )
        }
      />

      <section className="surface-card flex h-[75vh] overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          {messages.length === 0 ? (
            <EmptyState>
              {prompts.map((p, i) => {
                const style = PROMPT_STYLE[i % PROMPT_STYLE.length]!;
                return (
                  <SuggestionCard
                    key={p}
                    icon={style.icon}
                    tone={style.tone}
                    rail={style.rail}
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
                    "whitespace-pre-wrap text-[15px]",
                    m.role === "user"
                      ? "ml-auto max-w-[70%] rounded-2xl bg-primary px-4 py-2.5 text-primary-foreground"
                      : m.error
                        ? "max-w-[85%] rounded-xl border border-l-[3px] border-destructive/30 border-l-destructive bg-destructive/10 px-4 py-3 text-destructive"
                        : "max-w-[85%] rounded-xl border border-l-[3px] border-border border-l-primary bg-card px-4 py-3 text-foreground",
                  )}
                >
                  {m.role === "assistant"
                    ? renderMessageContent(m.content, t("inbox.open"))
                    : m.content}
                </div>
              ))}

              {sending && (
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
                disabled={sending || !input.trim()}
                aria-label={t("ai.send")}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                <Send className="h-5 w-5" />
              </button>
            </form>
            <p className="mt-2.5 text-center text-[11px] text-subtle">{t("ai.disclaimer")}</p>
          </div>
        </div>

        {historyOpen && (
          <HistoryPanel
            conversations={conversations}
            activeId={activeConversationId}
            onSelect={setActiveConversationId}
            onNew={onNewChat}
            onClose={() => setHistoryOpen(false)}
          />
        )}
      </section>
    </>
  );
}
