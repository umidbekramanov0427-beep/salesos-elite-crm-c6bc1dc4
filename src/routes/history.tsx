import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/layout/Primitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import {
  AUDIT_ENTITY_TYPES,
  useOrgActivityFeed,
  useProfilesRaw,
  type AuditEntityType,
} from "@/hooks/use-crm-data";
import { DateRangeFilter, type DateFilterValue } from "@/components/leaderboard/DateRangeFilter";
import { AuditTrailList } from "@/components/history/AuditTrailList";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Tarix — SalesOS Elite CRM" },
      {
        name: "description",
        content: "Full audit trail of every change across leads, deals, tasks and more.",
      },
    ],
  }),
  component: HistoryPage,
});

function HistoryContent() {
  const { t } = useI18n();
  const { rows, isLoading } = useOrgActivityFeed(300);
  const { data: profiles } = useProfilesRaw();

  const [entityType, setEntityType] = useState<AuditEntityType | "all">("all");
  const [actorId, setActorId] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<DateFilterValue>({
    from: null,
    to: null,
    label: t("lb.presetAll"),
  });

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (entityType !== "all" && r.entityType !== entityType) return false;
      if (actorId !== "all" && r.actorId !== actorId) return false;
      if (dateFilter.from && new Date(r.createdAt) < dateFilter.from) return false;
      if (dateFilter.to && new Date(r.createdAt) > dateFilter.to) return false;
      return true;
    });
  }, [rows, entityType, actorId, dateFilter]);

  return (
    <>
      <PageHeader title={t("history.title")} description={t("history.desc")} />

      <SectionCard title={t("lb.filters")} className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <Select value={entityType} onValueChange={(v) => setEntityType(v as typeof entityType)}>
            <SelectTrigger className="h-9 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("history.allEntities")}</SelectItem>
              {AUDIT_ENTITY_TYPES.map((e) => (
                <SelectItem key={e} value={e}>
                  {t(`history.entity.${e}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={actorId} onValueChange={setActorId}>
            <SelectTrigger className="h-9 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("leadFilter.allOwners")}</SelectItem>
              {(profiles ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name || p.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DateRangeFilter value={dateFilter} onChange={setDateFilter} />
        </div>
      </SectionCard>

      <SectionCard title={t("history.feedTitle")} description={t("history.feedDesc")}>
        {isLoading && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
          </div>
        )}
        {!isLoading && <AuditTrailList entries={filtered} emptyLabel={t("history.empty")} />}
      </SectionCard>
    </>
  );
}

function HistoryPage() {
  const { user } = useAuth();
  const { t } = useI18n();

  if (user && user.role === "rep") {
    return (
      <SectionCard title={t("admin.restrictedTitle")} description={t("admin.restrictedDesc")}>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <ShieldAlert className="h-4 w-4" /> {t("admin.restrictedHint")}
        </div>
      </SectionCard>
    );
  }

  return <HistoryContent />;
}
