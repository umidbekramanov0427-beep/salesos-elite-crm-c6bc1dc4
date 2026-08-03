import { createFileRoute } from "@tanstack/react-router";
import { Mail, MessageCircle, Phone, Search, Send } from "lucide-react";
import { PageHeader, SectionCard, StatCard } from "@/components/layout/Primitives";
import { CONTACTS } from "@/lib/crm-data";

export const Route = createFileRoute("/crm/contacts")({
  head: () => ({
    meta: [
      { title: "Contacts — SalesOS Elite CRM" },
      { name: "description", content: "Every decision maker with position, birthday, phone, email, Telegram, WhatsApp, deals and tasks." },
      { property: "og:title", content: "Contacts — SalesOS Elite CRM" },
      { property: "og:description", content: "People directory linked to companies, deals and tasks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContactsPage,
});

function ContactsPage() {
  return (
    <>
      <PageHeader title="Contacts" description="People behind every company, deal and conversation." />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total contacts" value="3,482" hint="across 640 companies" tone="mint" />
        <StatCard label="Decision makers" value="911" delta={5.4} />
        <StatCard label="Contacted this week" value="428" delta={9.1} />
        <StatCard label="Birthdays this month" value="17" hint="relationship touchpoints" />
      </div>

      <div className="mt-8">
        <SectionCard
          title="Contact directory"
          actions={
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <input
                placeholder="Search contacts"
                className="h-10 w-56 rounded-xl border border-border bg-surface pl-9 pr-3 text-sm outline-none placeholder:text-subtle focus:border-primary/40"
              />
            </div>
          }
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {CONTACTS.map((c) => (
              <article key={c.id} className="rounded-2xl border border-border bg-surface p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-mint text-sm font-semibold text-mint-foreground">
                    {c.initials}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{c.name}</p>
                    <p className="truncate text-xs text-subtle">{c.position} · {c.company}</p>
                  </div>
                </div>
                <dl className="mt-4 space-y-1.5 text-xs">
                  <div className="flex justify-between"><dt className="text-subtle">Phone</dt><dd className="font-medium">{c.phone}</dd></div>
                  <div className="flex justify-between"><dt className="text-subtle">Email</dt><dd className="max-w-[150px] truncate font-medium">{c.email}</dd></div>
                  <div className="flex justify-between"><dt className="text-subtle">Telegram</dt><dd className="font-medium">{c.telegram}</dd></div>
                  <div className="flex justify-between"><dt className="text-subtle">Birthday</dt><dd className="font-medium">{c.birthday}</dd></div>
                  <div className="flex justify-between"><dt className="text-subtle">Deals · tasks</dt><dd className="font-medium">{c.deals} · {c.tasks}</dd></div>
                </dl>
                <div className="mt-4 flex items-center gap-2">
                  {[Phone, MessageCircle, Send, Mail].map((Icon, i) => (
                    <button key={i} className="rounded-xl border border-border bg-background p-2 text-muted-foreground hover:bg-accent" aria-label="Contact action">
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
