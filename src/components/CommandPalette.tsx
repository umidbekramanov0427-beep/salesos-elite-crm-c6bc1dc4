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
import { useI18n } from "@/lib/i18n";

const COMMANDS = [
  { key: "cmd.createLead", icon: UserPlus },
  { key: "cmd.assignTask", icon: Zap },
  { key: "cmd.generateReport", icon: FileText },
  { key: "cmd.analyzeCalls", icon: Sparkles },
  { key: "cmd.createInvoice", icon: FileText },
] as const;

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useI18n();
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
      <CommandInput placeholder={t("cmd.placeholder")} />
      <CommandList>
        <CommandEmpty>{t("cmd.noResults")}</CommandEmpty>

        <CommandGroup heading={t("cmd.navigation")}>
          {NAV_ITEMS.map((item) => (
            <CommandItem key={item.to} value={`nav ${item.label}`} onSelect={() => go(item.to)}>
              <item.icon className="mr-2 h-4 w-4" />
              {t(`nav.${item.to}`)}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading={t("cmd.leads")}>
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

        <CommandGroup heading={t("cmd.people")}>
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

        <CommandGroup heading={t("cmd.tasks")}>
          {TASKS.map((tk) => (
            <CommandItem key={tk.id} value={`task ${tk.title}`} onSelect={() => go("/lead-tasks")}>
              {tk.title}
              <CommandShortcut>{tk.due}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading={t("cmd.commands")}>
          {COMMANDS.map((c) => (
            <CommandItem
              key={c.key}
              value={`command ${t(c.key)}`}
              onSelect={() => {
                onOpenChange(false);
                toast.success(t(c.key));
              }}
            >
              <c.icon className="mr-2 h-4 w-4" />
              {t(c.key)}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
