import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound, Loader2, ShieldAlert, Workflow, ScrollText, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionCard, StatCard, Pill } from "@/components/layout/Primitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useProfilesRaw, useUpdateProfile, type ProfileRow } from "@/hooks/use-crm-data";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Panel — SalesOS Elite" },
      {
        name: "description",
        content: "Employee and role management for workspace administrators.",
      },
      { property: "og:title", content: "Admin Panel — SalesOS Elite" },
      { property: "og:description", content: "Roles, permissions and workspace administration." },
    ],
  }),
  component: AdminPanel,
});

const ROLES: ProfileRow["role"][] = ["rep", "manager", "super_admin"];
const ROLE_LABEL: Record<ProfileRow["role"], string> = {
  rep: "Sales rep",
  manager: "Manager",
  super_admin: "Admin",
};

function AdminPanel() {
  const { user } = useAuth();

  if (user && user.role !== "super_admin") {
    return (
      <SectionCard
        title="Restricted"
        description="This page is only visible to workspace administrators."
      >
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <ShieldAlert className="h-4 w-4" /> Ask your admin for access if you believe this is a
          mistake.
        </div>
      </SectionCard>
    );
  }

  return <AdminPanelContent />;
}

function AdminPanelContent() {
  const { data: profiles, isLoading } = useProfilesRaw();
  const updateProfile = useUpdateProfile();
  const [savingId, setSavingId] = useState<string | null>(null);

  const employees = profiles ?? [];
  const adminCount = employees.filter((p) => p.role === "super_admin").length;

  async function changeRole(id: string, role: ProfileRow["role"]) {
    setSavingId(id);
    try {
      await updateProfile.mutateAsync({ id, patch: { role } });
      toast.success("Role updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Admin Panel"
        description="Restricted controls for workspace owners and administrators."
        actions={<Pill tone="danger">Admins only</Pill>}
      />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Employees"
          value={String(employees.length)}
          hint={`${adminCount} admins`}
          tone="mint"
        />
        <StatCard label="Active roles" value={String(new Set(employees.map((p) => p.role)).size)} />
        <StatCard
          label="Departments"
          value={String(new Set(employees.map((p) => p.department)).size)}
        />
        <StatCard
          label="Managers"
          value={String(employees.filter((p) => p.role === "manager").length)}
        />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <SectionCard
          title="Employee & role management"
          description="Sign-ups appear here automatically"
          className="xl:col-span-2"
        >
          {isLoading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading employees…
            </div>
          )}
          {!isLoading && employees.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No one has signed up yet.
            </p>
          )}
          {employees.length > 0 && (
            <div className="-m-6 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-subtle">
                    <th className="px-6 py-3 font-medium">Employee</th>
                    <th className="px-6 py-3 font-medium">Department</th>
                    <th className="px-6 py-3 font-medium">Email</th>
                    <th className="px-6 py-3 font-medium">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-border last:border-0 hover:bg-surface"
                    >
                      <td className="px-6 py-4 font-medium">{p.full_name || "—"}</td>
                      <td className="px-6 py-4 text-muted-foreground">{p.department}</td>
                      <td className="px-6 py-4 text-muted-foreground">{p.email}</td>
                      <td className="px-6 py-4">
                        <Select
                          value={p.role}
                          disabled={savingId === p.id}
                          onValueChange={(v) => changeRole(p.id, v as ProfileRow["role"])}
                        >
                          <SelectTrigger className="h-9 w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r} value={r}>
                                {ROLE_LABEL[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Controls">
            <ul className="space-y-3">
              {[
                { icon: Users, label: "Permissions matrix", href: "/crm-stages" },
                { icon: Workflow, label: "Funnels & pipeline stages", href: "/crm-stages" },
                {
                  icon: KeyRound,
                  label: "API keys — OpenAI, Telegram, WhatsApp",
                  href: "/integrations",
                },
                { icon: ScrollText, label: "Feature flags", href: "/settings" },
              ].map((c) => (
                <li key={c.label}>
                  <a
                    href={c.href}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium transition-colors hover:bg-accent"
                  >
                    <c.icon className="h-4 w-4 text-muted-foreground" />
                    {c.label}
                  </a>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="About roles">
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Admin</span> — full access, including
                role management.
              </li>
              <li>
                <span className="font-medium text-foreground">Manager</span> — can edit any record,
                cannot change roles.
              </li>
              <li>
                <span className="font-medium text-foreground">Sales rep</span> — can edit their own
                records.
              </li>
            </ul>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
