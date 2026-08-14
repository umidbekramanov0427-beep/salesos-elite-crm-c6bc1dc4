import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Circle, Loader2, Lock, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { cn, roleTone } from "@/lib/utils";
import {
  useCreateRolePermission,
  useRolePermissions,
  useUpdateRolePermission,
} from "@/hooks/use-crm-data";

type Role = "super_admin" | "rop" | "sotuv_menejeri";

const ROLES: Role[] = ["super_admin", "rop", "sotuv_menejeri"];

// Every real action a role can be gated on, grouped by the part of the
// product it belongs to -- mirrors the app's actual pages, not a generic
// template. super_admin is shown for context but is never editable: it's
// always fully allowed everywhere else in the app.
const CATEGORIES: { id: string; labelKey: string; actions: string[] }[] = [
  {
    id: "leads",
    labelKey: "rbac.cat.leads",
    actions: [
      "View leads",
      "Edit leads",
      "Delete leads",
      "Export leads",
      "Assign leads",
      "Merge leads",
      "Restore leads",
    ],
  },
  {
    id: "pipeline",
    labelKey: "rbac.cat.pipeline",
    actions: ["View pipeline", "Move deals", "Create deals", "Delete deals", "View revenue"],
  },
  {
    id: "tasks",
    labelKey: "rbac.cat.tasks",
    actions: ["View tasks", "Create tasks", "Assign tasks", "Delete tasks", "Complete tasks"],
  },
  {
    id: "reports",
    labelKey: "rbac.cat.reports",
    actions: ["View reports", "Export reports"],
  },
  {
    id: "audio",
    labelKey: "rbac.cat.audio",
    actions: ["View recordings", "AI call analysis", "Delete recordings"],
  },
  {
    id: "leaderboard",
    labelKey: "rbac.cat.leaderboard",
    actions: ["View leaderboard", "View revenue data", "View bonuses"],
  },
  {
    id: "ai",
    labelKey: "rbac.cat.ai",
    actions: ["Use AI assistant", "Generate messages"],
  },
  {
    id: "admin",
    labelKey: "rbac.cat.admin",
    actions: ["View admin panel", "Manage users", "Manage permissions", "Manage integrations"],
  },
];

const ACTION_LABEL_KEY: Record<string, string> = {
  "View leads": "stages.permission.viewLeads",
  "Edit leads": "stages.permission.editLeads",
  "Delete leads": "stages.permission.deleteLeads",
  "Export leads": "stages.permission.exportLeads",
  "Assign leads": "stages.permission.assignLeads",
  "Merge leads": "stages.permission.mergeLeads",
  "Restore leads": "stages.permission.restoreLeads",
  "View pipeline": "rbac.action.viewPipeline",
  "Move deals": "rbac.action.moveDeals",
  "Create deals": "rbac.action.createDeals",
  "Delete deals": "rbac.action.deleteDeals",
  "View revenue": "rbac.action.viewRevenue",
  "View tasks": "rbac.action.viewTasks",
  "Create tasks": "rbac.action.createTasks",
  "Assign tasks": "rbac.action.assignTasks",
  "Delete tasks": "rbac.action.deleteTasks",
  "Complete tasks": "rbac.action.completeTasks",
  "View reports": "rbac.action.viewReports",
  "Export reports": "rbac.action.exportReports",
  "View recordings": "rbac.action.viewRecordings",
  "AI call analysis": "rbac.action.aiCallAnalysis",
  "Delete recordings": "rbac.action.deleteRecordings",
  "View leaderboard": "rbac.action.viewLeaderboard",
  "View revenue data": "rbac.action.viewRevenueData",
  "View bonuses": "rbac.action.viewBonuses",
  "Use AI assistant": "rbac.action.useAiAssistant",
  "Generate messages": "rbac.action.generateMessages",
  "View admin panel": "rbac.action.viewAdminPanel",
  "Manage users": "rbac.action.manageUsers",
  "Manage permissions": "rbac.action.managePermissions",
  "Manage integrations": "rbac.action.manageIntegrations",
};

const ROLE_LABEL_KEY: Record<Role, string> = {
  super_admin: "admin.roleAdmin",
  rop: "admin.roleRop",
  sotuv_menejeri: "admin.roleRep",
};

export function PermissionsTable() {
  const { t } = useI18n();
  const { user } = useAuth();
  const canManage = user?.role === "super_admin" || user?.role === "platform_owner";
  const { data: permissions, isLoading } = useRolePermissions();
  const updatePermission = useUpdateRolePermission();
  const createPermission = useCreateRolePermission();
  const [selectedRole, setSelectedRole] = useState<Role>("rop");

  const byActionRole = new Map((permissions ?? []).map((p) => [`${p.action}::${p.role}`, p]));

  const isLocked = selectedRole === "super_admin";
  const editable = canManage && !isLocked;

  async function toggle(action: string) {
    if (!editable || !user?.organizationId) return;
    const row = byActionRole.get(`${action}::${selectedRole}`);
    try {
      if (row) {
        await updatePermission.mutateAsync({ id: row.id, patch: { allowed: !row.allowed } });
      } else {
        await createPermission.mutateAsync({
          organization_id: user.organizationId,
          role: selectedRole,
          action,
          allowed: true,
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("stages.permissionUpdateFailed"));
    }
  }

  function isAllowed(action: string): boolean {
    if (selectedRole === "super_admin") return true;
    return byActionRole.get(`${action}::${selectedRole}`)?.allowed ?? false;
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
      </div>
    );
  }

  const totalActions = CATEGORIES.reduce((sum, c) => sum + c.actions.length, 0);
  const allowedCount = CATEGORIES.reduce(
    (sum, c) => sum + c.actions.filter((a) => isAllowed(a)).length,
    0,
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-1.5">
        <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-subtle">
          {t("rbac.rolesHeading")}
        </p>
        {ROLES.map((role) => {
          const tone = roleTone(role);
          const active = role === selectedRole;
          return (
            <button
              key={role}
              type="button"
              onClick={() => setSelectedRole(role)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                active
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-border bg-surface text-foreground hover:bg-accent",
              )}
            >
              <span
                className={cn(
                  "h-2.5 w-2.5 shrink-0 rounded-full",
                  tone === "gold" && "bg-amber-500",
                  tone === "blue" && "bg-blue-500",
                  tone === "success" && "bg-success",
                  tone === "danger" && "bg-destructive",
                  tone === "neutral" && "bg-subtle",
                )}
              />
              <span className="flex-1 truncate">{t(ROLE_LABEL_KEY[role])}</span>
              {role === "super_admin" && <Lock className="h-3.5 w-3.5 shrink-0 opacity-70" />}
            </button>
          );
        })}
      </aside>

      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-destructive/30 bg-destructive/5 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm font-bold text-destructive">
                {t(ROLE_LABEL_KEY[selectedRole])}
              </p>
              {isLocked && <p className="text-xs text-destructive/80">{t("rbac.lockedHint")}</p>}
            </div>
          </div>
          <span className="text-sm font-bold text-destructive">
            {allowedCount}/{totalActions} {t("rbac.permissionsWord")}
          </span>
        </div>

        {CATEGORIES.map((cat) => {
          const allowedInCat = cat.actions.filter((a) => isAllowed(a)).length;
          return (
            <div
              key={cat.id}
              className="overflow-hidden rounded-xl border border-destructive/20 bg-card shadow-soft"
            >
              <div className="flex items-center justify-between border-b border-destructive/15 bg-destructive/5 px-4 py-2.5">
                <span className="text-sm font-bold text-foreground">{t(cat.labelKey)}</span>
                <span className="text-xs font-semibold text-subtle">
                  {allowedInCat}/{cat.actions.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {cat.actions.map((action) => {
                  const allowed = isAllowed(action);
                  return (
                    <button
                      key={action}
                      type="button"
                      disabled={!editable}
                      onClick={() => void toggle(action)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors",
                        allowed
                          ? "border-success/30 bg-success/10 text-success"
                          : "border-border bg-surface text-muted-foreground",
                        editable ? "cursor-pointer hover:opacity-80" : "cursor-default opacity-90",
                      )}
                    >
                      {allowed ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0" />
                      )}
                      <span className="truncate">{t(ACTION_LABEL_KEY[action] ?? action)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
