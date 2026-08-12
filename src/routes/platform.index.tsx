import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Loader2, Plus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionCard, Pill } from "@/components/layout/Primitives";
import { ConfirmDialog } from "@/components/ConfirmDialog";
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
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { timeAgo } from "@/lib/utils";
import {
  useOrganizations,
  useCreateOrganization,
  useDeactivateExpiredTrials,
} from "@/hooks/use-crm-data";

const PLANS = ["Basic", "Pro", "Enterprise"] as const;

export const Route = createFileRoute("/platform/")({
  head: () => ({
    meta: [
      { title: "Platform — SalesOS Elite" },
      { name: "description", content: "Platform owner: manage companies using SalesOS Elite." },
    ],
  }),
  component: PlatformPage,
});

function CreateOrgDialog() {
  const { t } = useI18n();
  const createOrg = useCreateOrganization();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [plan, setPlan] = useState<(typeof PLANS)[number]>("Basic");
  const [trialDays, setTrialDays] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setName("");
    setAdminName("");
    setAdminEmail("");
    setAdminPassword("");
    setPhone("");
    setPlan("Basic");
    setTrialDays("");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !adminEmail.trim() || adminPassword.length < 8) return;
    setConfirming(true);
  }

  async function submit() {
    setBusy(true);
    try {
      await createOrg.mutateAsync({
        name: name.trim(),
        admin_email: adminEmail.trim(),
        admin_password: adminPassword,
        admin_full_name: adminName.trim(),
        phone: phone.trim() || undefined,
        plan,
        trial_days: trialDays ? Number(trialDays) : undefined,
      });
      toast.success(t("platform.created"));
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("platform.createFailed"));
    } finally {
      setBusy(false);
    }
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
          <button className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
            <Plus className="h-4 w-4" /> {t("platform.createOrg")}
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("platform.createOrg")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="org-name">{t("platform.orgName")}</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="org-admin-name">{t("platform.adminName")}</Label>
              <Input
                id="org-admin-name"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="org-admin-email">{t("platform.adminEmail")}</Label>
              <Input
                id="org-admin-email"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="org-admin-password">{t("platform.adminPassword")}</Label>
              <Input
                id="org-admin-password"
                type="text"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <div>
              <Label htmlFor="org-phone">{t("platform.orgPhone")}</Label>
              <Input id="org-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="org-plan">{t("platform.orgPlan")}</Label>
              <select
                id="org-plan"
                value={plan}
                onChange={(e) => setPlan(e.target.value as (typeof PLANS)[number])}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {PLANS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="org-trial">{t("platform.orgTrialDays")}</Label>
              <Input
                id="org-trial"
                type="number"
                min={0}
                placeholder={t("platform.orgTrialPlaceholder")}
                value={trialDays}
                onChange={(e) => setTrialDays(e.target.value)}
              />
            </div>
            <DialogFooter>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("platform.create")}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("platform.confirmCreateTitle")}
        description={t("platform.confirmCreateDesc", { name: name.trim() })}
        onConfirm={() => {
          setConfirming(false);
          void submit();
        }}
      />
    </>
  );
}

function PlatformPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { data: orgs, isLoading } = useOrganizations();
  const deactivateExpired = useDeactivateExpiredTrials();

  useEffect(() => {
    if (user?.role === "platform_owner") void deactivateExpired.mutateAsync();
    // Runs once per page load to catch any trial that's expired since the
    // last visit — deliberately not in the deps array, deactivateExpired
    // is a new mutate function identity every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  if (user && user.role !== "platform_owner") {
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
      <PageHeader
        title={t("platform.title")}
        description={t("platform.desc")}
        actions={<CreateOrgDialog />}
      />

      <SectionCard title={t("platform.orgsTitle")}>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : !orgs?.length ? (
          <p className="text-sm text-muted-foreground">{t("platform.noOrgs")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {orgs.map((org) => (
              <li key={org.id}>
                <Link
                  to="/platform/organizations/$orgId"
                  params={{ orgId: org.id }}
                  className="flex items-center gap-3 py-3 transition-colors hover:bg-accent"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{org.name}</p>
                    <p className="truncate text-xs text-subtle">
                      {org.plan} · {t("platform.createdAt")}: {timeAgo(org.created_at)}
                      {org.trial_ends_at &&
                        ` · ${t("platform.trialEnds")}: ${new Date(org.trial_ends_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <Pill tone={org.active ? "success" : "neutral"}>
                    {org.active ? t("platform.active") : t("platform.inactive")}
                  </Pill>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}
