import { useState } from "react";
import { Building2, CalendarPlus, MessageCircle, Phone, Plus, Send, UserPlus, Users, X, ClipboardPlus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ACTIONS = [
  { label: "Create Lead", icon: UserPlus },
  { label: "Create Company", icon: Building2 },
  { label: "Create Deal", icon: ClipboardPlus },
  { label: "Create Task", icon: CalendarPlus },
  { label: "Create Employee", icon: Users },
  { label: "Schedule Call", icon: Phone },
  { label: "Send WhatsApp", icon: MessageCircle },
  { label: "Send Telegram", icon: Send },
];

export function QuickActions() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      {open && (
        <div className="animate-in fade-in slide-in-from-bottom-2 w-56 overflow-hidden rounded-2xl border border-border bg-popover p-1.5 shadow-elevated duration-200">
          {ACTIONS.map((a) => (
            <button
              key={a.label}
              onClick={() => {
                setOpen(false);
                toast.success(a.label, { description: "Quick action triggered" });
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <a.icon className="h-4 w-4 text-muted-foreground" />
              {a.label}
            </button>
          ))}
        </div>
      )}

      <button
        aria-label={open ? "Close quick actions" : "Open quick actions"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-elevated transition-transform duration-150 hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus className={cn("h-6 w-6 transition-transform duration-200", open && "rotate-45")} />
        <X className="hidden" />
      </button>
    </div>
  );
}
