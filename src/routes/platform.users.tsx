import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert, Users2 } from "lucide-react";
import { PageHeader, SectionCard, Pill } from "@/components/layout/Primitives";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useAllProfiles } from "@/hooks/use-crm-data";

export const Route = createFileRoute("/platform/users")({
  head: () => ({
    meta: [{ title: "Users — SalesOS Elite" }],
  }),
  component: PlatformUsersPage,
});

function PlatformUsersPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { data: profiles, isLoading } = useAllProfiles();

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
      <PageHeader title={t("platform.usersTitle")} description={t("platform.usersDesc")} />

      <SectionCard title={t("platform.usersTitle")}>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : !profiles?.length ? (
          <p className="flex items-center gap-2 text-sm text-subtle">
            <Users2 className="h-4 w-4" /> {t("platform.noUsers")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-subtle">
                  <th className="px-4 py-3 font-medium">{t("admin.colEmployee")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.colEmail")}</th>
                  <th className="px-4 py-3 font-medium">{t("platform.orgsTitle")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.colRole")}</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-surface">
                    <td className="px-4 py-3 font-medium">{p.full_name || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.organizations?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Pill tone="info">{p.role}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}
