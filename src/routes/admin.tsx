import { createFileRoute } from "@tanstack/react-router";
import { KeyRound, Users, Workflow, ScrollText } from "lucide-react";
import { PageHeader, SectionCard, StatCard, Pill } from "@/components/layout/Primitives";
import { REPS } from "@/lib/mock-data";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Panel — SalesOS Elite" },
      { name: "description", content: "Employee, role and permission management, automation, audit logs, feature flags and API keys." },
      { property: "og:title", content: "Admin Panel — SalesOS Elite" },
      { property: "og:description", content: "Roles, permissions, automation, audit logs and API keys." },
    ],
  }),
  component: AdminPanel,
});

const AUDIT = [
  { at: "09:41", who: "Aizhan Serikova", what: "Changed role of Ruslan Iskakov to SDR" },
  { at: "08:12", who: "System", what: "Automation “Stale deal reminder” executed on 42 leads" },
  { at: "Yesterday", who: "Daniyar Omarov", what: "Created funnel stage “Security review”" },
  { at: "Yesterday", who: "Aizhan Serikova", what: "Rotated OpenAI API key" },
];

function AdminPanel() {
  return (
    <>
      <PageHeader
        title="Admin Panel"
        description="Restricted controls for workspace owners and administrators."
        actions={<Pill tone="danger">Admins only</Pill>}
      />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Employees" value="34" hint="6 admins" tone="mint" />
        <StatCard label="Active roles" value="7" hint="42 permissions" />
        <StatCard label="Automations" value="12" hint="3 paused" />
        <StatCard label="API keys" value="5" hint="1 expiring soon" />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <SectionCard title="Employee & role management" className="xl:col-span-2">
          <div className="-m-6 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-subtle">
                  <th className="px-6 py-3 font-medium">Employee</th>
                  <th className="px-6 py-3 font-medium">Department</th>
                  <th className="px-6 py-3 font-medium">Role</th>
                  <th className="px-6 py-3 font-medium">Access</th>
                </tr>
              </thead>
              <tbody>
                {REPS.map((r, i) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface">
                    <td className="px-6 py-4 font-medium">{r.name}</td>
                    <td className="px-6 py-4 text-muted-foreground">{r.department}</td>
                    <td className="px-6 py-4 text-muted-foreground">{r.role}</td>
                    <td className="px-6 py-4">
                      <Pill tone={i === 0 ? "info" : "neutral"}>{i === 0 ? "Admin" : "Member"}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Controls">
            <ul className="space-y-3">
              {[
                { icon: Users, label: "Permissions matrix" },
                { icon: Workflow, label: "Funnels & automation" },
                { icon: KeyRound, label: "API keys — OpenAI, Telegram, WhatsApp" },
                { icon: ScrollText, label: "Feature flags" },
              ].map((c) => (
                <li
                  key={c.label}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium transition-colors hover:bg-accent"
                >
                  <c.icon className="h-4 w-4 text-muted-foreground" />
                  {c.label}
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Audit log">
            <ul className="space-y-4">
              {AUDIT.map((a) => (
                <li key={a.what}>
                  <p className="text-sm text-foreground">{a.what}</p>
                  <p className="mt-1 text-xs text-subtle">{a.who} · {a.at}</p>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
