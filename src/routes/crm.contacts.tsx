import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Mail, MessageCircle, Phone, Plus, Search, Send } from "lucide-react";
import { PageHeader, SectionCard, StatCard } from "@/components/layout/Primitives";
import { useContactsView } from "@/hooks/use-crm-data";
import { NewContactDialog } from "@/components/crm/quick-create";

export const Route = createFileRoute("/crm/contacts")({
  head: () => ({
    meta: [
      { title: "Contacts — SalesOS Elite CRM" },
      {
        name: "description",
        content:
          "Every decision maker with position, birthday, phone, email, Telegram, WhatsApp, deals and tasks.",
      },
      { property: "og:title", content: "Contacts — SalesOS Elite CRM" },
      {
        property: "og:description",
        content: "People directory linked to companies, deals and tasks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContactsPage,
});

function ContactsPage() {
  const [query, setQuery] = useState("");
  const { rows: contacts, isLoading } = useContactsView();

  const rows = useMemo(() => {
    const q = query.toLowerCase();
    return contacts.filter(
      (c) =>
        !q || [c.name, c.position, c.company, c.email].some((v) => v.toLowerCase().includes(q)),
    );
  }, [contacts, query]);

  const companiesCount = new Set(contacts.map((c) => c.companyId).filter(Boolean)).size;

  return (
    <>
      <PageHeader
        title="Contacts"
        description="People behind every company, deal and conversation."
        actions={
          <NewContactDialog
            trigger={
              <button className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90">
                <Plus className="h-4 w-4" /> New contact
              </button>
            }
          />
        }
      />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total contacts"
          value={String(contacts.length)}
          hint={`across ${companiesCount} companies`}
          tone="mint"
        />
        <StatCard label="With deals" value={String(contacts.filter((c) => c.deals > 0).length)} />
        <StatCard label="With email" value={String(contacts.filter((c) => c.email).length)} />
        <StatCard label="With phone" value={String(contacts.filter((c) => c.phone).length)} />
      </div>

      <div className="mt-8">
        <SectionCard
          title="Contact directory"
          actions={
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search contacts"
                className="h-10 w-56 rounded-xl border border-border bg-surface pl-9 pr-3 text-sm outline-none placeholder:text-subtle focus:border-primary/40"
              />
            </div>
          }
        >
          {isLoading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading contacts…
            </div>
          )}
          {!isLoading && rows.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No contacts yet. Click “New contact” to add your first one.
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((c) => (
              <article key={c.id} className="rounded-2xl border border-border bg-surface p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-mint text-sm font-semibold text-mint-foreground">
                    {c.initials}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{c.name}</p>
                    <p className="truncate text-xs text-subtle">
                      {c.position || "—"} · {c.company || "—"}
                    </p>
                  </div>
                </div>
                <dl className="mt-4 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-subtle">Phone</dt>
                    <dd className="font-medium">{c.phone || "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-subtle">Email</dt>
                    <dd className="max-w-[150px] truncate font-medium">{c.email || "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-subtle">Telegram</dt>
                    <dd className="font-medium">{c.telegram || "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-subtle">Birthday</dt>
                    <dd className="font-medium">{c.birthday}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-subtle">Deals · tasks</dt>
                    <dd className="font-medium">
                      {c.deals} · {c.tasks}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 flex items-center gap-2">
                  {[Phone, MessageCircle, Send, Mail].map((Icon, i) => (
                    <button
                      key={i}
                      className="rounded-xl border border-border bg-background p-2 text-muted-foreground hover:bg-accent"
                      aria-label="Contact action"
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
