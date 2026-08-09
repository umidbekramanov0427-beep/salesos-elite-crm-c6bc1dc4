import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound, Loader2, Pencil, ShieldAlert, Workflow, ScrollText, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionCard, StatCard, Pill } from "@/components/layout/Primitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
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

function AdminPanel() {
  const { user } = useAuth();
  const { t } = useI18n();

  if (user && user.role !== "super_admin") {
    return (
      <SectionCard title={t("admin.restrictedTitle")} description={t("admin.restrictedDesc")}>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <ShieldAlert className="h-4 w-4" /> {t("admin.restrictedHint")}
        </div>
      </SectionCard>
    );
  }

  return <AdminPanelContent />;
}

function AdminPanelContent() {
  const { t } = useI18n();
  const { data: profiles, isLoading } = useProfilesRaw();
  const updateProfile = useUpdateProfile();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmEditProfile, setConfirmEditProfile] = useState<ProfileRow | null>(null);
  const [pendingChange, setPendingChange] = useState<{
    profile: ProfileRow;
    role: ProfileRow["role"];
  } | null>(null);

  const roleLabel: Record<ProfileRow["role"], string> = {
    rep: t("admin.roleRep"),
    manager: t("admin.roleManager"),
    super_admin: t("admin.roleAdmin"),
  };

  const employees = profiles ?? [];
  const adminCount = employees.filter((p) => p.role === "super_admin").length;

  async function applyRoleChange(profile: ProfileRow, role: ProfileRow["role"]) {
    setSavingId(profile.id);
    try {
      await updateProfile.mutateAsync({ id: profile.id, patch: { role } });
      toast.success(t("admin.roleUpdated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.roleUpdateFailed"));
    } finally {
      setSavingId(null);
      setEditingId(null);
    }
  }

  return (
    <>
      <PageHeader
        title={t("admin.title")}
        description={t("admin.description")}
        actions={<Pill tone="danger">{t("admin.adminsOnly")}</Pill>}
      />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("admin.employees")}
          value={String(employees.length)}
          hint={`${adminCount} ${t("admin.admins")}`}
          tone="mint"
        />
        <StatCard
          label={t("admin.activeRoles")}
          value={String(new Set(employees.map((p) => p.role)).size)}
        />
        <StatCard
          label={t("admin.departments")}
          value={String(new Set(employees.map((p) => p.department)).size)}
        />
        <StatCard
          label={t("admin.managers")}
          value={String(employees.filter((p) => p.role === "manager").length)}
        />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <SectionCard
          title={t("admin.employeeMgmt")}
          description={t("admin.employeeMgmtDesc")}
          className="xl:col-span-2"
        >
          {isLoading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("admin.loadingEmployees")}
            </div>
          )}
          {!isLoading && employees.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("admin.noSignups")}
            </p>
          )}
          {employees.length > 0 && (
            <div className="-m-6 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-subtle">
                    <th className="px-6 py-3 font-medium">{t("admin.colEmployee")}</th>
                    <th className="px-6 py-3 font-medium">{t("admin.colDepartment")}</th>
                    <th className="px-6 py-3 font-medium">{t("admin.colEmail")}</th>
                    <th className="px-6 py-3 font-medium">{t("admin.colRole")}</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((p) => {
                    const isEditing = editingId === p.id;
                    return (
                      <tr
                        key={p.id}
                        className="border-b border-border last:border-0 hover:bg-surface"
                      >
                        <td className="px-6 py-4 font-medium">{p.full_name || "—"}</td>
                        <td className="px-6 py-4 text-muted-foreground">{p.department}</td>
                        <td className="px-6 py-4 text-muted-foreground">{p.email}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {isEditing ? (
                              <Select
                                value={p.role}
                                disabled={savingId === p.id}
                                onValueChange={(v) =>
                                  setPendingChange({ profile: p, role: v as ProfileRow["role"] })
                                }
                              >
                                <SelectTrigger className="h-9 w-36">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ROLES.map((r) => (
                                    <SelectItem key={r} value={r}>
                                      {roleLabel[r]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-sm font-medium">{roleLabel[p.role]}</span>
                            )}
                            <button
                              type="button"
                              aria-label={t("admin.editRole")}
                              onClick={() =>
                                isEditing ? setEditingId(null) : setConfirmEditProfile(p)
                              }
                              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title={t("admin.controls")}>
            <ul className="space-y-3">
              {[
                { icon: Users, label: t("admin.permissionsMatrix"), href: "/crm-stages" },
                { icon: Workflow, label: t("admin.funnelsStages"), href: "/crm-stages" },
                {
                  icon: KeyRound,
                  label: t("admin.apiKeys"),
                  href: "/integrations",
                },
                { icon: ScrollText, label: t("admin.featureFlags"), href: "/settings" },
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

          <SectionCard title={t("admin.aboutRoles")}>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">{t("admin.roleAdmin")}</span> —{" "}
                {t("admin.aboutRoleAdmin")}
              </li>
              <li>
                <span className="font-medium text-foreground">{t("admin.roleManager")}</span> —{" "}
                {t("admin.aboutRoleManager")}
              </li>
              <li>
                <span className="font-medium text-foreground">{t("admin.roleRep")}</span> —{" "}
                {t("admin.aboutRoleRep")}
              </li>
            </ul>
          </SectionCard>
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmEditProfile}
        onOpenChange={(open) => !open && setConfirmEditProfile(null)}
        title={t("admin.confirmEditTitle")}
        description={
          confirmEditProfile
            ? t("admin.confirmEditDesc", {
                name: confirmEditProfile.full_name || confirmEditProfile.email,
              })
            : undefined
        }
        onConfirm={() => {
          if (confirmEditProfile) setEditingId(confirmEditProfile.id);
          setConfirmEditProfile(null);
        }}
      />

      <ConfirmDialog
        open={!!pendingChange}
        onOpenChange={(open) => !open && setPendingChange(null)}
        title={t("admin.confirmSaveTitle")}
        description={
          pendingChange
            ? t("admin.confirmSaveDesc", {
                name: pendingChange.profile.full_name || pendingChange.profile.email,
                role: roleLabel[pendingChange.role],
              })
            : undefined
        }
        onConfirm={() => {
          if (pendingChange) void applyRoleChange(pendingChange.profile, pendingChange.role);
          setPendingChange(null);
        }}
      />
    </>
  );
}
