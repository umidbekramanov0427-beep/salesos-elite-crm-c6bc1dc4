import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, SectionCard } from "@/components/layout/Primitives";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — SalesOS Elite" },
      { name: "description", content: "Profile, workspace, language, appearance, notifications, integrations and branding." },
      { property: "og:title", content: "Settings — SalesOS Elite" },
      { property: "og:description", content: "Workspace, appearance, notification and integration settings." },
    ],
  }),
  component: SettingsPage,
});

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
      <input
        defaultValue={value}
        className="mt-2 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none transition-colors focus:border-primary/40 focus:bg-background"
      />
    </label>
  );
}

function Toggle({ label, description, on }: { label: string; description: string; on?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-6 py-4">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <span
        className={`mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${on ? "bg-success" : "bg-border"}`}
      >
        <span className={`h-5 w-5 rounded-full bg-background shadow-soft transition-transform ${on ? "translate-x-5" : ""}`} />
      </span>
    </div>
  );
}

function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Personal and workspace configuration for SalesOS Elite." />

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Profile">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Full name" value="Aizhan Serikova" />
            <Field label="Email" value="aizhan@salesos.kz" />
            <Field label="Role" value="Administrator" />
            <Field label="Phone" value="+7 701 234 5678" />
          </div>
        </SectionCard>

        <SectionCard title="Workspace">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Company" value="SalesOS Elite" />
            <Field label="Currency" value="USD" />
            <Field label="Language" value="English" />
            <Field label="Timezone" value="Asia/Almaty (UTC+5)" />
          </div>
        </SectionCard>

        <SectionCard title="Notifications">
          <div className="divide-y divide-border">
            <Toggle label="Task assignments" description="Notify me when a task is assigned to me" on />
            <Toggle label="Overdue alerts" description="Daily digest of overdue lead tasks" on />
            <Toggle label="AI call insights" description="Alert when AI detects a critical objection" on />
            <Toggle label="Weekly report" description="Monday morning revenue summary" />
          </div>
        </SectionCard>

        <SectionCard title="Appearance & integrations">
          <div className="divide-y divide-border">
            <Toggle label="Dark theme" description="Switch the workspace to the dark palette" />
            <Toggle label="Compact density" description="Reduce vertical spacing across tables" />
            <Toggle label="Telegram" description="Send notifications to the sales channel" on />
            <Toggle label="WhatsApp Business" description="Sync lead conversations" />
          </div>
        </SectionCard>
      </div>
    </>
  );
}
