import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Circle, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionCard, Pill } from "@/components/layout/Primitives";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { cn, describeError } from "@/lib/utils";
import { useAmoCatalog, useSaveAmoImportSettings } from "@/hooks/use-crm-data";

export const Route = createFileRoute("/admin/amocrm-import")({
  head: () => ({
    meta: [
      { title: "AmoCRM import sozlamalari — SalesOS Elite" },
      {
        name: "description",
        content: "AmoCRM'dan qaysi voronkalar va operatorlar sinxronlanishini tanlang.",
      },
    ],
  }),
  component: AmoImportSettingsPage,
});

function ImportSettingsPage() {
  const { t } = useI18n();
  const { data: catalog, isLoading, isError, refetch, isFetching } = useAmoCatalog();
  const save = useSaveAmoImportSettings();

  const [pipelineIds, setPipelineIds] = useState<Set<number>>(new Set());
  const [userIds, setUserIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!catalog) return;
    setPipelineIds(new Set(catalog.enabledPipelineIds ?? catalog.pipelines.map((p) => p.id)));
    setUserIds(new Set(catalog.enabledUserIds ?? catalog.operators.map((o) => o.id)));
  }, [catalog]);

  function toggle(set: Set<number>, setter: (v: Set<number>) => void, id: number) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  async function onSave() {
    setSaving(true);
    try {
      await save.mutateAsync({
        pipelineIds: Array.from(pipelineIds),
        userIds: Array.from(userIds),
      });
      toast.success(t("amocrmImport.saved"));
    } catch (err) {
      toast.error(describeError(err, t("amocrmImport.saveFailed")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t("amocrmImport.title")}
        description={t("amocrmImport.desc")}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-60"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
              {t("amocrmImport.reload")}
            </button>
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={saving || isLoading || isError}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("common.save")}
            </button>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
        </div>
      ) : isError || !catalog ? (
        <SectionCard>
          <p className="text-sm text-destructive">{t("amocrmImport.loadFailed")}</p>
        </SectionCard>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard
            title={t("amocrmImport.pipelinesTitle")}
            description={t("amocrmImport.pipelinesDesc")}
          >
            {catalog.pipelines.length === 0 ? (
              <p className="py-6 text-center text-sm text-subtle">{t("amocrmImport.empty")}</p>
            ) : (
              <ul className="max-h-[32rem] space-y-1 overflow-y-auto">
                {catalog.pipelines.map((p) => {
                  const checked = pipelineIds.has(p.id);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => toggle(pipelineIds, setPipelineIds, p.id)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent",
                          checked && "bg-primary/5",
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          {checked ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                          ) : (
                            <Circle className="h-4 w-4 shrink-0 text-subtle" />
                          )}
                          <span className="truncate font-medium text-foreground">{p.name}</span>
                        </span>
                        {p.is_main && <Pill tone="neutral">{t("amocrmImport.main")}</Pill>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title={t("amocrmImport.operatorsTitle")}
            description={t("amocrmImport.operatorsDesc")}
          >
            {catalog.operators.length === 0 ? (
              <p className="py-6 text-center text-sm text-subtle">{t("amocrmImport.empty")}</p>
            ) : (
              <ul className="max-h-[32rem] space-y-1 overflow-y-auto">
                {catalog.operators.map((o) => {
                  const checked = userIds.has(o.id);
                  return (
                    <li key={o.id}>
                      <button
                        type="button"
                        onClick={() => toggle(userIds, setUserIds, o.id)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent",
                          checked && "bg-primary/5",
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          {checked ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                          ) : (
                            <Circle className="h-4 w-4 shrink-0 text-subtle" />
                          )}
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-foreground">
                              {o.name}
                            </span>
                            {o.email && (
                              <span className="block truncate text-xs text-subtle">{o.email}</span>
                            )}
                          </span>
                        </span>
                        {o.existingProfileEmail && (
                          <Pill tone="success">{t("amocrmImport.existingAccount")}</Pill>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        </div>
      )}
    </>
  );
}

function AmoImportSettingsPage() {
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

  return <ImportSettingsPage />;
}
