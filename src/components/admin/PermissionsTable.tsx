import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Pill } from "@/components/layout/Primitives";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useRolePermissions, useUpdateRolePermission } from "@/hooks/use-crm-data";

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

export function PermissionsTable() {
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
