import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, ShieldAlert, Users2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionCard, Pill } from "@/components/layout/Primitives";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { timeAgo } from "@/lib/utils";
import {
  useOrganizations,
  useUpdateOrganization,
  useAllProfiles,
  useAllAmoConnections,
  useAllAiAgents,
} from "@/hooks/use-crm-data";

const PLANS = ["Basic", "Pro", "Enterprise"] as const;

export const Route = createFileRoute("/platform/organizations/$orgId")({
  head: () => ({
    meta: [{ title: "Company — SalesOS Elite" }],
  }),
  component: OrgDetailPage,
});

function OrgDetailPage() {
  const { orgId } = Route.useParams();
  const { user } = useAuth();
  const { t } = useI18n();
  const { data: orgs, isLoading } = useOrganizations();
  const { data: profiles } = useAllProfiles();
  const { data: amoConnections } = useAllAmoConnections();
  const { data: aiAgents } = useAllAiAgents();
  const updateOrg = useUpdateOrganization();

  const org = orgs?.find((o) => o.id === orgId);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [plan, setPlan] = useState<string>("Basic");
  const [confirming, setConfirming] = useState<null | "save" | "deactivate" | "activate">(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (org) {
      setName(org.name);
      setPhone(org.phone ?? "");
      setPlan(org.plan);
    }
  }, [org]);

  if (user && user.role !== "platform_owner") {
    return (
      <SectionCard title={t("admin.restrictedTitle")} description={t("admin.restrictedDesc")}>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <ShieldAlert className="h-4 w-4" /> {t("admin.restrictedHint")}
        </div>
      </SectionCard>
    );
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  if (!org) {
    return (
      <SectionCard
        title={t("platform.orgNotFoundTitle")}
        description={t("platform.orgNotFoundDesc")}
      >
        <Link to="/platform" className="text-sm font-medium text-primary hover:underline">
          {t("platform.backToList")}
        </Link>
      </SectionCard>
    );
  }

  const orgUsers = (profiles ?? []).filter((p) => p.organization_id === org.id);
  const amoConnection = (amoConnections ?? []).find((c) => c.organization_id === org.id);
  const orgAiAgents = (aiAgents ?? []).filter((a) => a.organization_id === org.id);

  async function saveDetails() {
    setBusy(true);
    try {
      await updateOrg.mutateAsync({
        id: org!.id,
        patch: { name: name.trim(), phone: phone.trim() || null, plan },
      });
      toast.success(t("platform.orgUpdated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("platform.orgUpdateFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive() {
    setBusy(true);
    try {
      await updateOrg.mutateAsync({ id: org!.id, patch: { active: !org!.active } });
      toast.success(org!.active ? t("platform.orgDeactivated") : t("platform.orgActivated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("platform.orgUpdateFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={org.name}
        description={t("platform.orgDetailDesc")}
        actions={
          <Link
            to="/platform"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" /> {t("platform.backToList")}
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title={t("platform.orgDetailsTitle")}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="detail-name">{t("platform.orgName")}</Label>
              <Input id="detail-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="detail-phone">{t("platform.orgPhone")}</Label>
              <Input id="detail-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="detail-plan">{t("platform.orgPlan")}</Label>
              <select
                id="detail-plan"
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {PLANS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            {org.trial_ends_at && (
              <p className="text-xs text-subtle">
                {t("platform.trialEnds")}: {new Date(org.trial_ends_at).toLocaleDateString()}
              </p>
            )}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming("save")}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("common.save")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(org.active ? "deactivate" : "activate")}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-60"
              >
                {org.active ? t("platform.deactivate") : t("platform.activate")}
              </button>
              <Pill tone={org.active ? "success" : "neutral"}>
                {org.active ? t("platform.active") : t("platform.inactive")}
              </Pill>
            </div>
          </div>
        </SectionCard>

        <SectionCard title={t("platform.orgStatusTitle")}>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("platform.amocrmStatus")}</span>
              {amoConnection ? (
                <Pill tone={amoConnection.last_sync_error ? "danger" : "success"}>
                  {amoConnection.subdomain}
                </Pill>
              ) : (
                <Pill tone="neutral">{t("platform.notConnected")}</Pill>
              )}
            </li>
            {amoConnection?.last_synced_at && (
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("platform.lastSynced")}</span>
                <span className="text-foreground">{timeAgo(amoConnection.last_synced_at)}</span>
              </li>
            )}
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("platform.aiAgentsStatus")}</span>
              <Pill tone={orgAiAgents.some((a) => a.active) ? "success" : "neutral"}>
                {orgAiAgents.filter((a) => a.active).length}/{orgAiAgents.length}
              </Pill>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("platform.createdAt")}</span>
              <span className="text-foreground">{timeAgo(org.created_at)}</span>
            </li>
          </ul>
        </SectionCard>
      </div>

      <SectionCard title={t("platform.orgUsersTitle")}>
        {orgUsers.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-subtle">
            <Users2 className="h-4 w-4" /> {t("platform.noUsers")}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {orgUsers.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {p.full_name || p.email}
                  </p>
                  <p className="truncate text-xs text-subtle">{p.email}</p>
                </div>
                <Pill tone="info">{p.role}</Pill>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <ConfirmDialog
        open={confirming === "save"}
        onOpenChange={(v) => !v && setConfirming(null)}
        title={t("platform.confirmSaveTitle")}
        description={t("platform.confirmSaveDesc", { name: name.trim() })}
        onConfirm={() => {
          setConfirming(null);
          void saveDetails();
        }}
      />
      <ConfirmDialog
        open={confirming === "deactivate" || confirming === "activate"}
        onOpenChange={(v) => !v && setConfirming(null)}
        title={
          confirming === "deactivate"
            ? t("platform.confirmDeactivateTitle")
            : t("platform.confirmActivateTitle")
        }
        description={t("platform.confirmActiveDesc", { name: org.name })}
        onConfirm={() => {
          setConfirming(null);
          void toggleActive();
        }}
      />
    </>
  );
}
