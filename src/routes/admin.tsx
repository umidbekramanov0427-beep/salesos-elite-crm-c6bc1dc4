import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  AlertOctagon,
  ChevronDown,
  Check,
  KeyRound,
  Loader2,
  Pencil,
  ShieldAlert,
  UserPlus,
  Workflow,
  ScrollText,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionCard, StatCard, Pill } from "@/components/layout/Primitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { cn, timeAgo } from "@/lib/utils";
import {
  useProfilesRaw,
  useUpdateProfile,
  useCreateEmployee,
  useErrorLogsRaw,
  useResolveErrorLog,
  type ErrorLogRow,
  type ProfileRow,
} from "@/hooks/use-crm-data";

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

function CreateEmployeeDialog() {
  const { t } = useI18n();
  const createEmployee = useCreateEmployee();
  const updateProfile = useUpdateProfile();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<ProfileRow["role"]>("rep");
  const [department, setDepartment] = useState("Sales");
  const [busy, setBusy] = useState(false);

  const roleLabel: Record<ProfileRow["role"], string> = {
    rep: t("admin.roleRep"),
    manager: t("admin.roleManager"),
    super_admin: t("admin.roleAdmin"),
  };

  function reset() {
    setFullName("");
    setEmail("");
    setPassword("");
    setRole("rep");
    setDepartment("Sales");
  }

  async function submit() {
    setBusy(true);
    try {
      const { id } = await createEmployee.mutateAsync({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
      });
      await updateProfile.mutateAsync({ id, patch: { role, department: department.trim() } });
      toast.success(t("admin.employeeCreated"));
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.employeeCreateFailed"));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || password.length < 8) return;
    setConfirming(true);
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
      >
        <DialogTrigger asChild>
          <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium text-muted-foreground hover:bg-accent">
            <UserPlus className="h-4 w-4" /> {t("admin.addEmployee")}
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.addEmployee")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="emp-name">{t("admin.newEmployeeName")}</Label>
              <Input
                id="emp-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="emp-email">{t("admin.colEmail")}</Label>
              <Input
                id="emp-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="emp-password">{t("admin.newEmployeePassword")}</Label>
              <Input
                id="emp-password"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("admin.colRole")}</Label>
                <Select value={role} onValueChange={(v) => setRole(v as ProfileRow["role"])}>
                  <SelectTrigger className="h-10">
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
              </div>
              <div>
                <Label htmlFor="emp-dept">{t("admin.colDepartment")}</Label>
                <Input
                  id="emp-dept"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("admin.addEmployee")}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("admin.confirmCreateTitle")}
        description={t("admin.confirmCreateDesc", { name: fullName.trim(), role: roleLabel[role] })}
        onConfirm={() => void submit()}
      />
    </>
  );
}

function ErrorLogRowItem({ log }: { log: ErrorLogRow }) {
  const { t } = useI18n();
  const resolveLog = useResolveErrorLog();
  const [expanded, setExpanded] = useState(false);

  async function onResolve() {
    try {
      await resolveLog.mutateAsync({ id: log.id, patch: { resolved: true } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.errors.resolveFailed"));
    }
  }

  return (
    <li
      className={cn(
        "rounded-xl border px-4 py-3",
        log.resolved ? "border-border bg-surface" : "border-destructive/30 bg-destructive/5",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
        >
          <ChevronDown
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0 text-subtle transition-transform",
              expanded && "rotate-180",
            )}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{log.message}</p>
            <p className="mt-1 text-xs text-subtle">
              {log.source} · {log.route ?? "—"} · {timeAgo(log.created_at)}
            </p>
          </div>
        </button>
        {!log.resolved && (
          <button
            onClick={onResolve}
            disabled={resolveLog.isPending}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent disabled:opacity-60"
          >
            {resolveLog.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            {t("admin.errors.resolve")}
          </button>
        )}
      </div>
      {expanded && log.stack && (
        <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-background p-3 text-xs text-muted-foreground">
          {log.stack}
        </pre>
      )}
    </li>
  );
}

function ErrorLogsSection() {
  const { t } = useI18n();
  const { data: logs, isLoading } = useErrorLogsRaw();
  const [showResolved, setShowResolved] = useState(false);

  const rows = logs ?? [];
  const unresolved = rows.filter((l) => !l.resolved);
  const visible = showResolved ? rows : unresolved;

  return (
    <SectionCard
      title={t("admin.errors.title")}
      description={t("admin.errors.desc")}
      actions={
        <div className="flex items-center gap-2">
          <Pill tone={unresolved.length > 0 ? "danger" : "success"}>
            {t("admin.errors.unresolvedCount", { count: unresolved.length })}
          </Pill>
          <button
            onClick={() => setShowResolved((s) => !s)}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-border px-3 text-xs font-medium text-muted-foreground hover:bg-accent"
          >
            {showResolved ? t("admin.errors.hideResolved") : t("admin.errors.showAll")}
          </button>
        </div>
      }
    >
      {isLoading && (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
        </div>
      )}
      {!isLoading && visible.length === 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-muted-foreground">
          <AlertOctagon className="mx-auto h-5 w-5 text-success" />
          <p className="mx-auto">{t("admin.errors.none")}</p>
        </div>
      )}
      <ul className="space-y-2">
        {visible.slice(0, 50).map((log) => (
          <ErrorLogRowItem key={log.id} log={log} />
        ))}
      </ul>
    </SectionCard>
  );
}

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
        actions={
          <>
            <CreateEmployeeDialog />
            <Pill tone="danger">{t("admin.adminsOnly")}</Pill>
          </>
        }
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

      <div className="mt-8">
        <ErrorLogsSection />
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
