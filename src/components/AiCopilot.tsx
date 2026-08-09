import { useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Sparkles, Send } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";

const PROMPTS = [
  "Summarize today's sales.",
  "Which leads are at risk?",
  "Who needs follow-up?",
  "Generate weekly report.",
  "Explain pipeline drop.",
];

type Msg = { role: "user" | "assistant"; text: string };

export function AiCopilot({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const page =
    NAV_ITEMS.find((i) => i.to && (i.to === "/" ? pathname === "/" : pathname.startsWith(i.to)))
      ?.label ?? "Workspace";
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");

  const ask = (text: string) => {
    if (!text.trim()) return;
    setMessages((m) => [
      ...m,
      { role: "user", text },
      {
        role: "assistant",
        text: `Looking at the ${page} page: revenue is up 12.4% today ($48,200 from 4 closed deals). Two enterprise deals worth $146,500 have been stuck in Negotiation for 9+ days, and first-response time in SMB rose to 38 minutes. Priority next step — call Silk Road Cargo, they opened the proposal 5 times in the last 24 hours.`,
      },
    ]);
    setInput("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-mint-foreground" /> AI Copilot
          </SheetTitle>
          <SheetDescription>Context: {page}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-2">
          {messages.length === 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
                Try asking
              </p>
              {PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => ask(p)}
                  className="w-full rounded-xl border border-border px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {p}
                </button>
              ))}
            </div>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "ml-auto max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground"
                    : "max-w-[90%] rounded-2xl bg-mint px-3 py-2 text-sm leading-relaxed text-foreground"
                }
              >
                {m.text}
              </div>
            ))
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="flex items-center gap-2 border-t border-border p-4"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the copilot…"
            aria-label="Ask the AI copilot"
            className="h-10 flex-1 rounded-xl border border-border bg-surface px-3 text-sm outline-none placeholder:text-subtle focus:border-primary/40 focus:bg-background"
          />
          <button
            type="submit"
            aria-label="Send"
            className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
