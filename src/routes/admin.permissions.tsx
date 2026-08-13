import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Lock, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionCard, Pill } from "@/components/layout/Primitives";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useRolePermissions, useUpdateRolePermission } from "@/hooks/use-crm-data";

export const Route = createFileRoute("/admin/permissions")({
  head: () => ({
    meta: [
      { title: "Huquqlar jadvali — SalesOS Elite" },
      {
        name: "description",
        content: "Har bir rol qaysi CRM amallarni bajara olishini boshqaring.",
      },
    ],
  }),
  component: PermissionsPage,
});

const PERMISSION_ACTIONS = [
  "View leads",
  "Edit leads",
  "Delete leads",
  "Export leads",
  "Assign leads",
  "Merge leads",
  "Restore leads",
] as const;
const PERMISSION_ROLES = ["super_admin", "rop", "sotuv_menejeri"] as const;

const PERMISSION_KEY: Record<string, string> = {
  "View leads": "stages.permission.viewLeads",
  "Edit leads": "stages.permission.editLeads",
  "Delete leads": "stages.permission.deleteLeads",
  "Export leads": "stages.permission.exportLeads",
  "Assign leads": "stages.permission.assignLeads",
  "Merge leads": "stages.permission.mergeLeads",
  "Restore leads": "stages.permission.restoreLeads",
};

function PermissionsTable() {
  const { t } = useI18n();
  const { user } = useAuth();
  const canManage = user?.role === "super_admin" || user?.role === "platform_owner";
  const { data: permissions, isLoading } = useRolePermissions();
  const updatePermission = useUpdateRolePermission();

  const byActionRole = new Map((permissions ?? []).map((p) => [`${p.action}::${p.role}`, p]));

  async function toggle(action: string, role: (typeof PERMISSION_ROLES)[number]) {
    const row = byActionRole.get(`${action}::${role}`);
    if (!row) return;
    try {
      await updatePermission.mutateAsync({ id: row.id, patch: { allowed: !row.allowed } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("stages.permissionUpdateFailed"));
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-subtle">
            <th className="py-3 font-medium">{t("stages.colAction")}</th>
            <th className="py-3 font-medium">{t("stages.colAdmin")}</th>
            <th className="py-3 font-medium">{t("stages.colManager")}</th>
            <th className="py-3 font-medium">{t("stages.colRep")}</th>
          </tr>
        </thead>
        <tbody>
          {PERMISSION_ACTIONS.map((action) => (
            <tr key={action} className="border-b border-border last:border-0">
              <td className="py-3 font-medium text-foreground">
                {t(PERMISSION_KEY[action] ?? action)}
              </td>
              {PERMISSION_ROLES.map((role) => {
                const row = byActionRole.get(`${action}::${role}`);
                const allowed = row?.allowed ?? false;
                // super_admin is always fully allowed everywhere else in the
                // app — shown here for context, not editable.
                const editable = canManage && role !== "super_admin";
                return (
                  <td key={role} className="py-3">
                    <button
                      type="button"
                      disabled={!editable}
                      onClick={() => editable && void toggle(action, role)}
                      className={editable ? "cursor-pointer" : "cursor-default"}
                    >
                      <Pill tone={allowed ? "success" : "neutral"}>
                        {allowed ? t("stages.allowed") : t("stages.denied")}
                      </Pill>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PermissionsPage() {
  const { t } = useI18n();
  const { user } = useAuth();

  if (user && user.role !== "super_admin" && user.role !== "platform_owner") {
    return (
      <SectionCard title={t("admin.restrictedTitle")} description={t("admin.restrictedDesc")}>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <ShieldAlert className="h-4 w-4" /> {t("admin.restrictedHint")}
        </div>
      </SectionCard>
    );
  }

  return (
    <>
      <PageHeader title={t("stages.permissions")} description={t("stages.permissionsDesc")} />
      <SectionCard
        className="border-2 border-destructive/30"
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
            <Lock className="h-3.5 w-3.5" />
            {t("stages.permissionsImportant")}
          </span>
        }
      >
        <PermissionsTable />
      </SectionCard>
    </>
  );
}
