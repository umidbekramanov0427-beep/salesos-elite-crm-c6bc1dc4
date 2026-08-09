import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { formatDate, formatFollowUp, initialsOf, timeAgo } from "@/lib/utils";

type Tables = Database["public"]["Tables"];
export type ProfileRow = Tables["profiles"]["Row"];
export type StageRow = Tables["pipeline_stages"]["Row"];
export type CompanyRow = Tables["companies"]["Row"];
export type ContactRow = Tables["contacts"]["Row"];
export type LeadRow = Tables["leads"]["Row"];
export type DealRow = Tables["deals"]["Row"];
export type TaskRow = Tables["tasks"]["Row"];
export type NotificationRow = Tables["notifications"]["Row"];
export type LeadActivityRow = Tables["lead_activities"]["Row"];

/* ------------------------------------------------------------------ */
/* Generic CRUD resource factory — one query key per table, list reads */
/* plus create/update/delete mutations that invalidate that key.       */
/* ------------------------------------------------------------------ */

function makeResource<TableName extends keyof Tables>(table: TableName, queryKey: QueryKey) {
  type Row = Tables[TableName]["Row"];
  type Insert = Tables[TableName]["Insert"];
  type Update = Tables[TableName]["Update"];

  function useList(config?: { orderBy?: string; ascending?: boolean; enabled?: boolean }) {
    return useQuery({
      queryKey,
      enabled: config?.enabled ?? true,
      queryFn: async (): Promise<Row[]> => {
        let query = supabase.from(table).select("*");
        if (config?.orderBy)
          query = query.order(config.orderBy, { ascending: config?.ascending ?? true });
        const { data, error } = await query;
        if (error) throw error;
        return (data ?? []) as unknown as Row[];
      },
    });
  }

  function useCreate() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (input: Insert): Promise<Row> => {
        const { data, error } = await supabase
          .from(table)
          .insert(input as never)
          .select()
          .single();
        if (error) throw error;
        return data as unknown as Row;
      },
      onSuccess: () => void qc.invalidateQueries({ queryKey }),
    });
  }

  function useUpdate() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async ({ id, patch }: { id: string; patch: Update }): Promise<Row> => {
        const { data, error } = await supabase
          .from(table)
          .update(patch as never)
          .eq("id" as never, id)
          .select()
          .single();
        if (error) throw error;
        return data as unknown as Row;
      },
      onSuccess: () => void qc.invalidateQueries({ queryKey }),
    });
  }

  function useRemove() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq("id" as never, id);
        if (error) throw error;
        return id;
      },
      onSuccess: () => void qc.invalidateQueries({ queryKey }),
    });
  }

  return { useList, useCreate, useUpdate, useRemove };
}

const companiesResource = makeResource("companies", ["companies"]);
const contactsResource = makeResource("contacts", ["contacts"]);
const leadsResource = makeResource("leads", ["leads"]);
const dealsResource = makeResource("deals", ["deals"]);
const tasksResource = makeResource("tasks", ["tasks"]);
const profilesResource = makeResource("profiles", ["profiles"]);
const stagesResource = makeResource("pipeline_stages", ["pipeline_stages"]);
const notificationsResource = makeResource("notifications", ["notifications"]);
const leadActivitiesResource = makeResource("lead_activities", ["lead_activities"]);

export const useCompaniesRaw = (opts?: Parameters<typeof companiesResource.useList>[0]) =>
  companiesResource.useList({ orderBy: "created_at", ascending: false, ...opts });
export const useCreateCompany = companiesResource.useCreate;
export const useUpdateCompany = companiesResource.useUpdate;
export const useDeleteCompany = companiesResource.useRemove;

export const useContactsRaw = (opts?: Parameters<typeof contactsResource.useList>[0]) =>
  contactsResource.useList({ orderBy: "created_at", ascending: false, ...opts });
export const useCreateContact = contactsResource.useCreate;
export const useUpdateContact = contactsResource.useUpdate;
export const useDeleteContact = contactsResource.useRemove;

export const useLeadsRaw = (opts?: Parameters<typeof leadsResource.useList>[0]) =>
  leadsResource.useList({ orderBy: "created_at", ascending: false, ...opts });
export const useCreateLead = leadsResource.useCreate;
export const useUpdateLead = leadsResource.useUpdate;
export const useDeleteLead = leadsResource.useRemove;

export const useDealsRaw = (opts?: Parameters<typeof dealsResource.useList>[0]) =>
  dealsResource.useList({ orderBy: "created_at", ascending: false, ...opts });
export const useCreateDeal = dealsResource.useCreate;
export const useUpdateDeal = dealsResource.useUpdate;
export const useDeleteDeal = dealsResource.useRemove;

export const useTasksRaw = (opts?: Parameters<typeof tasksResource.useList>[0]) =>
  tasksResource.useList({ orderBy: "due_date", ascending: true, ...opts });
export const useCreateTask = tasksResource.useCreate;
export const useUpdateTask = tasksResource.useUpdate;
export const useDeleteTask = tasksResource.useRemove;

export const useProfilesRaw = (opts?: Parameters<typeof profilesResource.useList>[0]) =>
  profilesResource.useList({ orderBy: "full_name", ...opts });
export const useUpdateProfile = profilesResource.useUpdate;
export const useDeleteProfile = profilesResource.useRemove;

export const usePipelineStagesRaw = (opts?: Parameters<typeof stagesResource.useList>[0]) =>
  stagesResource.useList({ orderBy: "position", ...opts });
export const useCreateStage = stagesResource.useCreate;
export const useUpdateStage = stagesResource.useUpdate;

export const useCreateNotification = notificationsResource.useCreate;
export const useUpdateNotification = notificationsResource.useUpdate;

export const useLeadActivities = (leadId: string | undefined) =>
  useQuery({
    queryKey: ["lead_activities", leadId],
    enabled: !!leadId,
    queryFn: async (): Promise<LeadActivityRow[]> => {
      const { data, error } = await supabase
        .from("lead_activities")
        .select("*")
        .eq("lead_id", leadId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
export const useCreateLeadActivity = leadActivitiesResource.useCreate;

export function useNotificationsRaw() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ------------------------------------------------------------------ */
/* Lookup maps — small helpers shared by the view hooks below.         */
/* ------------------------------------------------------------------ */

function byId<T extends { id: string }>(rows: T[] | undefined): Map<string, T> {
  const m = new Map<string, T>();
  for (const r of rows ?? []) m.set(r.id, r);
  return m;
}

function profileName(p: ProfileRow | undefined): string {
  return p?.full_name || p?.email || "Unassigned";
}

/* ------------------------------------------------------------------ */
/* Composite loader — everything the CRM views need, fetched once and  */
/* joined client-side (small workspace-scale data, no N+1 queries).    */
/* ------------------------------------------------------------------ */

export function useCrmBase() {
  const companies = useCompaniesRaw();
  const contacts = useContactsRaw();
  const leads = useLeadsRaw();
  const deals = useDealsRaw();
  const stages = usePipelineStagesRaw();
  const profiles = useProfilesRaw();

  const isLoading =
    companies.isLoading ||
    contacts.isLoading ||
    leads.isLoading ||
    deals.isLoading ||
    stages.isLoading ||
    profiles.isLoading;
  const isError =
    companies.isError ||
    contacts.isError ||
    leads.isError ||
    deals.isError ||
    stages.isError ||
    profiles.isError;

  return {
    companies: companies.data ?? [],
    contacts: contacts.data ?? [],
    leads: leads.data ?? [],
    deals: deals.data ?? [],
    stages: stages.data ?? [],
    profiles: profiles.data ?? [],
    isLoading,
    isError,
  };
}

/* ------------------------------------------------------------------ */
/* View: CRM Leads (register + detail page) — shaped like the former  */
/* CrmLead mock type so existing UI keeps working against real data.  */
/* ------------------------------------------------------------------ */

export type CrmLeadView = {
  id: string;
  name: string;
  initials: string;
  company: string;
  companyId: string;
  position: string;
  phone: string;
  altPhone: string;
  email: string;
  telegram: string;
  whatsapp: string;
  source: string;
  campaign: string;
  utm: string;
  owner: string;
  ownerId: string;
  manager: string;
  priority: LeadRow["priority"];
  score: number;
  temperature: LeadRow["temperature"];
  budget: number;
  expectedRevenue: number;
  country: string;
  region: string;
  city: string;
  address: string;
  stage: string;
  stageId: string;
  funnel: string;
  nextFollowUp: string;
  lastContact: string;
  created: string;
  updated: string;
  tags: string[];
};

export function useCrmLeads() {
  const base = useCrmBase();

  const rows = useMemo<CrmLeadView[]>(() => {
    const contactsById = byId(base.contacts);
    const profilesById = byId(base.profiles);
    const stagesById = byId(base.stages);

    return base.leads.map((l): CrmLeadView => {
      const contact = l.contact_id ? contactsById.get(l.contact_id) : undefined;
      const owner = l.owner_id ? profilesById.get(l.owner_id) : undefined;
      const manager = l.manager_id ? profilesById.get(l.manager_id) : undefined;
      const stage = l.stage_id ? stagesById.get(l.stage_id) : undefined;
      return {
        id: l.id,
        name: l.name,
        initials: initialsOf(l.name),
        company: l.company_name,
        companyId: l.company_id ?? "",
        position: contact?.position ?? "",
        phone: contact?.phone ?? "",
        altPhone: contact?.alt_phone ?? "",
        email: contact?.email ?? "",
        telegram: contact?.telegram ?? "",
        whatsapp: contact?.whatsapp ?? "",
        source: l.source ?? "",
        campaign: l.campaign ?? "",
        utm: l.utm ?? "",
        owner: owner ? profileName(owner) : "Unassigned",
        ownerId: l.owner_id ?? "",
        manager: manager ? profileName(manager) : "—",
        priority: l.priority,
        score: l.score,
        temperature: l.temperature,
        budget: l.budget,
        expectedRevenue: l.expected_revenue,
        country: l.country ?? "",
        region: l.region ?? "",
        city: l.city ?? "",
        address: l.address ?? "",
        stage: stage?.name ?? "New Lead",
        stageId: l.stage_id ?? "",
        funnel: l.funnel ?? "",
        nextFollowUp: formatFollowUp(l.next_follow_up),
        lastContact: timeAgo(l.last_contact_at),
        created: formatDate(l.created_at),
        updated: timeAgo(l.updated_at),
        tags: l.tags ?? [],
      };
    });
  }, [base.leads, base.contacts, base.profiles, base.stages]);

  return { rows, ...base };
}

/* ------------------------------------------------------------------ */
/* View: Companies                                                     */
/* ------------------------------------------------------------------ */

export type CompanyView = {
  id: string;
  name: string;
  initials: string;
  industry: string;
  employees: string;
  revenue: number;
  website: string;
  city: string;
  owner: string;
  contacts: number;
  deals: number;
  openValue: number;
};

export function useCompaniesView() {
  const base = useCrmBase();

  const rows = useMemo<CompanyView[]>(() => {
    const profilesById = byId(base.profiles);
    return base.companies.map((c): CompanyView => {
      const contactCount = base.contacts.filter((ct) => ct.company_id === c.id).length;
      const companyDeals = base.deals.filter((d) => d.company_id === c.id);
      const openValue = companyDeals
        .filter((d) => d.status === "open")
        .reduce((sum, d) => sum + Number(d.value), 0);
      const owner = c.owner_id ? profilesById.get(c.owner_id) : undefined;
      return {
        id: c.id,
        name: c.name,
        initials: initialsOf(c.name),
        industry: c.industry ?? "",
        employees: c.employees_range ?? "",
        revenue: Number(c.annual_revenue ?? 0),
        website: c.website ?? "",
        city: c.city ?? "",
        owner: owner ? profileName(owner) : "Unassigned",
        contacts: contactCount,
        deals: companyDeals.length,
        openValue,
      };
    });
  }, [base.companies, base.contacts, base.deals, base.profiles]);

  return { rows, ...base };
}

/* ------------------------------------------------------------------ */
/* View: Contacts                                                      */
/* ------------------------------------------------------------------ */

export type ContactView = {
  id: string;
  name: string;
  initials: string;
  position: string;
  company: string;
  companyId: string;
  phone: string;
  email: string;
  telegram: string;
  whatsapp: string;
  birthday: string;
  deals: number;
  tasks: number;
};

export function useContactsView() {
  const base = useCrmBase();

  const rows = useMemo<ContactView[]>(() => {
    const companiesById = byId(base.companies);
    return base.contacts.map((ct): ContactView => {
      const company = ct.company_id ? companiesById.get(ct.company_id) : undefined;
      const dealsCount = base.deals.filter((d) => d.contact_id === ct.id).length;
      const leadIds = new Set(base.leads.filter((l) => l.contact_id === ct.id).map((l) => l.id));
      return {
        id: ct.id,
        name: ct.full_name,
        initials: initialsOf(ct.full_name),
        position: ct.position ?? "",
        company: company?.name ?? "",
        companyId: ct.company_id ?? "",
        phone: ct.phone ?? "",
        email: ct.email ?? "",
        telegram: ct.telegram ?? "",
        whatsapp: ct.whatsapp ?? "",
        birthday: ct.birthday ? formatDate(ct.birthday) : "—",
        deals: dealsCount,
        tasks: leadIds.size,
      };
    });
  }, [base.contacts, base.companies, base.deals, base.leads]);

  return { rows, ...base };
}

/* ------------------------------------------------------------------ */
/* View: Deals                                                         */
/* ------------------------------------------------------------------ */

export type DealView = {
  id: string;
  name: string;
  company: string;
  companyId: string;
  value: number;
  currency: string;
  probability: number;
  closeDate: string;
  owner: string;
  ownerId: string;
  stage: string;
  stageId: string;
  pipeline: string;
  status: DealRow["status"];
  products: number;
  discount: number;
  tax: number;
};

export function useDealsView() {
  const base = useCrmBase();

  const rows = useMemo<DealView[]>(() => {
    const companiesById = byId(base.companies);
    const profilesById = byId(base.profiles);
    const stagesById = byId(base.stages);
    return base.deals.map((d): DealView => {
      const company = d.company_id ? companiesById.get(d.company_id) : undefined;
      const owner = d.owner_id ? profilesById.get(d.owner_id) : undefined;
      const stage = d.stage_id ? stagesById.get(d.stage_id) : undefined;
      return {
        id: d.id,
        name: d.name,
        company: company?.name ?? "",
        companyId: d.company_id ?? "",
        value: Number(d.value),
        currency: d.currency,
        probability: d.probability,
        closeDate: formatDate(d.close_date),
        owner: owner ? profileName(owner) : "Unassigned",
        ownerId: d.owner_id ?? "",
        stage: stage?.name ?? "",
        stageId: d.stage_id ?? "",
        pipeline: d.pipeline ?? "",
        status: d.status,
        products: d.products_count,
        discount: Number(d.discount),
        tax: Number(d.tax),
      };
    });
  }, [base.deals, base.companies, base.profiles, base.stages]);

  return { rows, ...base };
}

/* ------------------------------------------------------------------ */
/* View: Tasks (Important Tasks + Lead Tasks share the same table)     */
/* ------------------------------------------------------------------ */

export type TaskView = {
  id: string;
  title: string;
  description: string;
  assignee: string;
  assigneeId: string;
  priority: TaskRow["priority"];
  status: TaskRow["status"];
  due: string;
  dueRaw: string | null;
  progress: number;
  leadId: string | null;
  leadName: string | null;
};

export function useTasksView() {
  const tasks = useTasksRaw();
  const profiles = useProfilesRaw();
  const leads = useLeadsRaw();

  const rows = useMemo<TaskView[]>(() => {
    const profilesById = byId(profiles.data);
    const leadsById = byId(leads.data);
    return (tasks.data ?? []).map((t): TaskView => {
      const assignee = t.assignee_id ? profilesById.get(t.assignee_id) : undefined;
      const lead = t.lead_id ? leadsById.get(t.lead_id) : undefined;
      return {
        id: t.id,
        title: t.title,
        description: t.description ?? "",
        assignee: assignee ? profileName(assignee) : "Unassigned",
        assigneeId: t.assignee_id ?? "",
        priority: t.priority,
        status: t.status,
        due: formatFollowUp(t.due_date),
        dueRaw: t.due_date,
        progress: t.progress,
        leadId: t.lead_id,
        leadName: lead?.name ?? null,
      };
    });
  }, [tasks.data, profiles.data, leads.data]);

  return {
    rows,
    isLoading: tasks.isLoading || profiles.isLoading || leads.isLoading,
    isError: tasks.isError || profiles.isError || leads.isError,
  };
}

/* ------------------------------------------------------------------ */
/* View: Notifications (Inbox)                                         */
/* ------------------------------------------------------------------ */

export type NotificationView = {
  id: string;
  type: string;
  title: string;
  body: string;
  unread: boolean;
  meta: string;
};

export function useNotificationsView() {
  const q = useNotificationsRaw();
  const rows = useMemo<NotificationView[]>(
    () =>
      (q.data ?? []).map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body ?? "",
        unread: !n.read,
        meta: timeAgo(n.created_at),
      })),
    [q.data],
  );
  return { rows, isLoading: q.isLoading, isError: q.isError };
}

/* ------------------------------------------------------------------ */
/* Dashboard aggregates — KPIs, revenue series, pipeline & funnel       */
/* stats and recent activity, all computed from real CRM rows.         */
/* ------------------------------------------------------------------ */

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function useRevenueSeries() {
  const { data: deals } = useDealsRaw();

  return useMemo(() => {
    const rows = deals ?? [];
    const now = new Date();
    const months: { label: string; revenue: number; pipeline: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const revenue = rows
        .filter((r) => r.status === "won" && r.close_date && monthKey(r.close_date) === key)
        .reduce((s, r) => s + Number(r.value), 0);
      const pipeline = rows
        .filter((r) => r.status === "open" && monthKey(r.created_at) === key)
        .reduce((s, r) => s + Number(r.value), 0);
      months.push({ label: MONTH_LABELS[d.getMonth()]!, revenue, pipeline });
    }
    return months;
  }, [deals]);
}

export function usePipelineStageStats() {
  const { data: deals } = useDealsRaw();
  const { data: stages } = usePipelineStagesRaw();

  return useMemo(() => {
    const rows = deals ?? [];
    return (stages ?? []).map((s) => {
      const inStage = rows.filter((d) => d.stage_id === s.id);
      return {
        stage: s.name,
        value: inStage.reduce((sum, d) => sum + Number(d.value), 0),
        deals: inStage.length,
      };
    });
  }, [deals, stages]);
}

export function useFunnelFlow() {
  const { rows: leads, stages } = useCrmLeads();
  return useMemo(() => {
    const ordered = [...stages].sort((a, b) => a.position - b.position);
    const base = leads.length || 1;
    return ordered.map((s) => {
      const count = leads.filter((l) => l.stageId === s.id).length;
      return { stage: s.name, count, conversion: Math.round((count / base) * 1000) / 10 };
    });
  }, [leads, stages]);
}

export type DashboardKpi = {
  id: string;
  label: string;
  value: string;
  comparison: string;
  tooltip: string;
};

export function useDashboardKpis() {
  const { data: deals } = useDealsRaw();
  const { data: leads } = useLeadsRaw();

  return useMemo(() => {
    const dealRows = deals ?? [];
    const leadRows = leads ?? [];
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);
    const weekAgo = Date.now() - 7 * 86400000;

    const wonToday = dealRows.filter(
      (d) => d.status === "won" && d.close_date && new Date(d.close_date) >= startOfToday,
    );
    const wonThisMonth = dealRows.filter(
      (d) => d.status === "won" && d.close_date && new Date(d.close_date) >= startOfMonth,
    );
    const openDeals = dealRows.filter((d) => d.status === "open");
    const wonThisWeek = dealRows.filter(
      (d) => d.status === "won" && d.close_date && new Date(d.close_date).getTime() >= weekAgo,
    );
    const lostThisWeek = dealRows.filter(
      (d) => d.status === "lost" && new Date(d.updated_at).getTime() >= weekAgo,
    );
    const newLeadsToday = leadRows.filter((l) => new Date(l.created_at) >= startOfToday);
    const wonLeadsTotal = dealRows.filter((d) => d.status === "won").length;
    const conversion = leadRows.length ? (wonLeadsTotal / leadRows.length) * 100 : 0;

    const revenueToday = wonToday.reduce((s, d) => s + Number(d.value), 0);
    const revenueMonth = wonThisMonth.reduce((s, d) => s + Number(d.value), 0);
    const pipelineValue = openDeals.reduce((s, d) => s + Number(d.value), 0);

    return {
      revenueToday,
      revenueMonth,
      pipelineValue,
      openDealsCount: openDeals.length,
      newLeadsToday: newLeadsToday.length,
      wonThisWeek: wonThisWeek.length,
      lostThisWeek: lostThisWeek.length,
      conversion,
    };
  }, [deals, leads]);
}

export type ActivityItem = {
  id: string;
  who: string;
  what: string;
  when: string;
  leadName: string | null;
};

export function useRecentActivity(limit = 6) {
  const { user } = useAuth();
  const activityQuery = useQuery({
    queryKey: ["recent-activity"],
    enabled: !!user,
    queryFn: async (): Promise<LeadActivityRow[]> => {
      const { data, error } = await supabase
        .from("lead_activities")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: leads } = useLeadsRaw();
  const { data: profiles } = useProfilesRaw();

  const rows = useMemo<ActivityItem[]>(() => {
    const leadsById = byId(leads);
    const profilesById = byId(profiles);
    return (activityQuery.data ?? []).map((a) => {
      const lead = leadsById.get(a.lead_id);
      const author = a.created_by ? profilesById.get(a.created_by) : undefined;
      return {
        id: a.id,
        who: author ? profileName(author) : "Someone",
        what: `${a.type}: ${a.content}`,
        when: timeAgo(a.created_at),
        leadName: lead?.company_name || lead?.name || null,
      };
    });
  }, [activityQuery.data, leads, profiles]);

  return { rows, isLoading: activityQuery.isLoading };
}

export function useTopPerformers(limit = 5) {
  const { data: deals } = useDealsRaw();
  const { data: profiles } = useProfilesRaw();

  return useMemo(() => {
    const rows = deals ?? [];
    const people = profiles ?? [];
    return people
      .map((p) => {
        const won = rows.filter((d) => d.owner_id === p.id && d.status === "won");
        const revenue = won.reduce((s, d) => s + Number(d.value), 0);
        return {
          id: p.id,
          name: p.full_name || p.email,
          department: p.department,
          deals: won.length,
          revenue,
          target: p.monthly_target || 1,
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }, [deals, profiles, limit]);
}

/* ------------------------------------------------------------------ */
/* AmoCRM integration — status readout + manual sync trigger.          */
/* ------------------------------------------------------------------ */

export type IntegrationSettingRow = Database["public"]["Tables"]["integration_settings"]["Row"];

export function useIntegrationSetting(key: string) {
  return useQuery({
    queryKey: ["integration_settings", key],
    queryFn: async (): Promise<IntegrationSettingRow | null> => {
      const { data, error } = await supabase
        .from("integration_settings")
        .select("*")
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useTriggerAmoCrmSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<{ synced: number; error?: string }> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/integrations/amocrm/sync", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Sync failed");
      return json;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["leads"] });
      void qc.invalidateQueries({ queryKey: ["integration_settings", "amocrm"] });
    },
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      email: string;
      password: string;
      full_name: string;
    }): Promise<{ id: string }> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/admin/create-employee", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create employee");
      return json;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["profiles"] });
    },
  });
}

export function useAiAssistantChat() {
  return useMutation({
    mutationFn: async (
      messages: { role: "user" | "assistant"; content: string }[],
    ): Promise<string> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/ai-assistant/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "AI assistant failed");
      return json.reply as string;
    },
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });
}
