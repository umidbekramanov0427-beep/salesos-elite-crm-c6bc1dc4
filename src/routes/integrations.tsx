import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plug, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionCard, Pill } from "@/components/layout/Primitives";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/integrations")({
  head: () => ({
    meta: [
      { title: "Integrations — SalesOS Elite CRM" },
      {
        name: "description",
        content: "Connect Salesforce, HubSpot, Slack, Google Sheets, Telegram and more to your SalesOS Elite workspace.",
      },
      { property: "og:title", content: "Integrations — SalesOS Elite CRM" },
      { property: "og:description", content: "Connect and manage the tools your revenue team uses every day." },
    ],
  }),
  component: IntegrationsPage,
});

type Catalog = { id: string; name: string; category: "crm" | "messaging" | "data" | "ai" | "other"; blurb: string; color: string };

const CATALOG: Catalog[] = [
  { id: "salesforce", name: "Salesforce", category: "crm", blurb: "Two-way account, contact and opportunity sync.", color: "#00A1E0" },
  { id: "hubspot", name: "HubSpot", category: "crm", blurb: "Import lifecycle stages and marketing contacts.", color: "#FF7A59" },
  { id: "amocrm", name: "amoCRM", category: "crm", blurb: "Sync leads and pipelines with amoCRM.", color: "#2E9BFF" },
  { id: "google-sheets", name: "Google Sheets", category: "data", blurb: "Export leaderboard and pipeline snapshots.", color: "#0F9D58" },
  { id: "slack", name: "Slack", category: "messaging", blurb: "Post deal-won and milestone alerts to channels.", color: "#611F69" },
  { id: "telegram", name: "Telegram", category: "messaging", blurb: "Bot notifications and lead conversations.", color: "#229ED9" },
  { id: "whatsapp", name: "WhatsApp Business", category: "messaging", blurb: "Templates, replies and chat history sync.", color: "#25D366" },
  { id: "gmail", name: "Gmail", category: "messaging", blurb: "Two-way email sync with thread tracking.", color: "#EA4335" },
  { id: "openai", name: "OpenAI", category: "ai", blurb: "Call summaries, sentiment and reply drafting.", color: "#10A37F" },
  { id: "twilio", name: "Twilio", category: "other", blurb: "SIP calling, SMS and recording pipeline.", color: "#F22F46" },
  { id: "stripe", name: "Stripe", category: "other", blurb: "Payment status on deals and invoices.", color: "#635BFF" },
  { id: "webhooks", name: "Webhooks", category: "other", blurb: "Outbound events to any HTTPS endpoint.", color: "#64748B" },
];

type Installed = { id: string; active: boolean; addedAt: string; lastSync: string | null };

const STORAGE_KEY = "salesos.integrations";

const DEFAULTS: Installed[] = [
  { id: "telegram", active: true, addedAt: new Date().toISOString(), lastSync: new Date().toISOString() },
  { id: "openai", active: true, addedAt: new Date().toISOString(), lastSync: new Date().toISOString() },
  { id: "whatsapp", active: false, addedAt: new Date().toISOString(), lastSync: null },
];

function IntegrationsPage() {
  const { t } = useI18n();
  const [installed, setInstalled] = useState<Installed[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      setInstalled(raw ? (JSON.parse(raw) as Installed[]) : DEFAULTS);
    } catch {
      setInstalled(DEFAULTS);
    }
    setHydrated(true);
  }, []);

  const persist = useCallback((next: Installed[]) => {
    setInstalled(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const byId = useMemo(() => new Map(CATALOG.map((c) => [c.id, c])), []);
  const available = CATALOG.filter((c) => !installed.some((i) => i.id === c.id));

  function add(c: Catalog) {
    persist([...installed, { id: c.id, active: true, addedAt: new Date().toISOString(), lastSync: new Date().toISOString() }]);
    setOpen(false);
    toast.success(t("int.connectedToast", { name: c.name }));
  }

  function toggle(id: string) {
    const item = installed.find((i) => i.id === id);
    if (!item) return;
    const active = !item.active;
    persist(
      installed.map((i) =>
        i.id === id ? { ...i, active, lastSync: active ? new Date().toISOString() : i.lastSync } : i,
      ),
    );
    const name = byId.get(id)?.name ?? id;
    toast[active ? "success" : "message"](t(active ? "int.connectedToast" : "int.disconnectedToast", { name }));
  }

  function remove(id: string) {
    persist(installed.filter((i) => i.id !== id));
    toast.message(t("int.removedToast", { name: byId.get(id)?.name ?? id }));
  }

  return (
    <>
      <PageHeader
        title={t("int.title")}
        description={t("int.description")}
        actions={
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            {t("int.add")}
          </button>
        }
      />

      <SectionCard title={t("int.connected")} description={`${installed.filter((i) => i.active).length} / ${installed.length}`}>
        {!hydrated ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : installed.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("int.none")}</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {installed.map((item) => {
              const meta = byId.get(item.id);
              if (!meta) return null;
              return (
                <li key={item.id} className="surface-card flex flex-col gap-4 p-5">
                  <div className="flex items-start gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                      style={{ backgroundColor: meta.color }}
                      aria-hidden
                    >
                      {meta.name[0]}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{meta.name}</p>
                      <p className="text-[11px] text-subtle">{t(`int.category.${meta.category}`)}</p>
                    </div>
                    <span className="ml-auto">
                      <Pill tone={item.active ? "success" : "danger"}>
                        {item.active ? t("common.active") : t("common.inactive")}
                      </Pill>
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed text-muted-foreground">{meta.blurb}</p>

                  <p className="text-[11px] text-subtle">
                    {t("int.lastSync")}:{" "}
                    {item.lastSync ? new Date(item.lastSync).toLocaleString() : t("int.never")}
                  </p>

                  <div className="mt-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggle(item.id)}
                      className={cn(
                        "flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-colors",
                        item.active
                          ? "border border-border bg-surface text-muted-foreground hover:bg-accent"
                          : "bg-primary text-primary-foreground hover:opacity-90",
                      )}
                    >
                      {item.active ? t("common.disconnect") : t("common.connect")}
                    </button>
                    <button
                      type="button"
                      aria-label={t("int.remove")}
                      onClick={() => remove(item.id)}
                      className="rounded-xl border border-border p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plug className="h-4 w-4 text-primary" />
              {t("int.add")}
            </DialogTitle>
            <DialogDescription>{t("int.addDesc")}</DialogDescription>
          </DialogHeader>

          <ul className="grid gap-3 sm:grid-cols-2">
            {available.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => add(c)}
                  className="flex w-full items-start gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:border-primary/40 hover:bg-surface"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                    style={{ backgroundColor: c.color }}
                    aria-hidden
                  >
                    {c.name[0]}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">{c.name}</span>
                    <span className="block text-[11px] text-subtle">{c.blurb}</span>
                  </span>
                </button>
              </li>
            ))}
            {available.length === 0 && (
              <li className="text-sm text-muted-foreground">—</li>
            )}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
