import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { NAV_ITEMS } from "@/lib/nav";
import { LEADS, REPS, TASKS } from "@/lib/mock-data";
import { toast } from "sonner";
import { FileText, Sparkles, UserPlus, Zap } from "lucide-react";

const COMMANDS = [
  { label: "Create Lead", icon: UserPlus },
  { label: "Assign Task", icon: Zap },
  { label: "Generate Report", icon: FileText },
  { label: "Analyze Calls", icon: Sparkles },
  { label: "Create Invoice", icon: FileText },
];

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const go = (to: string) => {
    onOpenChange(false);
    navigate({ to });
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search leads, people, tasks, commands…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          {NAV_ITEMS.map((item) => (
            <CommandItem key={item.to} value={`nav ${item.label}`} onSelect={() => go(item.to)}>
              <item.icon className="mr-2 h-4 w-4" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Leads">
          {LEADS.map((l) => (
            <CommandItem
              key={l.id}
              value={`lead ${l.company} ${l.contact}`}
              onSelect={() => go("/crm-stages")}
            >
              {l.company}
              <CommandShortcut>{l.stage}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="People">
          {REPS.map((r) => (
            <CommandItem
              key={r.id}
              value={`person ${r.name} ${r.department}`}
              onSelect={() => go("/")}
            >
              {r.name}
              <CommandShortcut>{r.department}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Tasks">
          {TASKS.map((t) => (
            <CommandItem key={t.id} value={`task ${t.title}`} onSelect={() => go("/tasks")}>
              {t.title}
              <CommandShortcut>{t.due}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Commands">
          {COMMANDS.map((c) => (
            <CommandItem
              key={c.label}
              value={`command ${c.label}`}
              onSelect={() => {
                onOpenChange(false);
                toast.success(c.label);
              }}
            >
              <c.icon className="mr-2 h-4 w-4" />
              {c.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
