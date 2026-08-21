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
export type TaskCommentRow = Tables["task_comments"]["Row"];
export type NotificationRow = Tables["notifications"]["Row"];
export type LeadActivityRow = Tables["lead_activities"]["Row"];
export type AmoCrmCallRow = Tables["amocrm_calls"]["Row"];
export type QualificationGroupRow = Tables["call_qualification_groups"]["Row"];
export type QualificationCriterionRow = Tables["call_qualification_criteria"]["Row"];
export type CallCategoryRow = Tables["call_categories"]["Row"];
export type CallSkillRow = Tables["call_skills"]["Row"];
export type CallStageRow = Tables["call_stages"]["Row"];
export type CallStageStepRow = Tables["call_stage_steps"]["Row"];

/* ------------------------------------------------------------------ */
/* Generic CRUD resource factory — one query key per table, list reads */
/* plus create/update/delete mutations that invalidate that key.       */
/* ------------------------------------------------------------------ */

// Supabase/PostgREST caps a single select() response at 1000 rows by
// default — a plain `.select("*")` with no `.range()` silently truncates
// past that instead of erroring, so any org whose row count crosses 1000
// (leads is the first table this happened to) quietly loses data off the
// end with no error anywhere. Page through with `.range()` until a page
// comes back short, keeping a stable `id` tiebreaker so results stay
// disjoint across pages regardless of what orderBy the caller asked for.
const RESOURCE_PAGE_SIZE = 1000;
// Large AmoCRM-synced accounts can have several thousand rows per table
// (leads/contacts/companies/pipeline_stages). Fetching pages one at a time,
// each awaited before the next request even starts, meant every CRM page
// load paid the full network round-trip cost of every page in sequence —
// the dominant cause of "still loading" for these accounts. Requesting a
// batch of pages concurrently (same pattern used for AmoCRM's own paginated
// fetches in client.server.ts) cuts that wall-clock time roughly by the
// batch size.
const LIST_PAGE_CONCURRENCY = 4;

function makeResource<TableName extends keyof Tables>(table: TableName, queryKey: QueryKey) {
  type Row = Tables[TableName]["Row"];
  type Insert = Tables[TableName]["Insert"];
  type Update = Tables[TableName]["Update"];

  function useList(config?: {
    orderBy?: string;
    ascending?: boolean;
    enabled?: boolean;
    refetchInterval?: number | false;
  }) {
    return useQuery({
      queryKey,
      enabled: config?.enabled ?? true,
      refetchInterval: config?.refetchInterval ?? false,
      queryFn: async (): Promise<Row[]> => {
        const fetchPage = async (from: number): Promise<Row[]> => {
          let query = supabase.from(table).select("*");
          if (config?.orderBy)
            query = query.order(config.orderBy, { ascending: config?.ascending ?? true });
          query = query
            .order("id" as never, { ascending: true })
            .range(from, from + RESOURCE_PAGE_SIZE - 1);
          const { data, error } = await query;
          if (error) throw error;
          return (data ?? []) as unknown as Row[];
        };

        const all: Row[] = [];
        let from = 0;
        let done = false;
        while (!done) {
          const starts = Array.from(
            { length: LIST_PAGE_CONCURRENCY },
            (_, i) => from + i * RESOURCE_PAGE_SIZE,
          );
          const pages = await Promise.all(starts.map(fetchPage));
          for (const page of pages) {
            all.push(...page);
            if (page.length < RESOURCE_PAGE_SIZE) done = true;
          }
          from += LIST_PAGE_CONCURRENCY * RESOURCE_PAGE_SIZE;
        }
        return all;
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
const workSessionsResource = makeResource("work_sessions", ["work_sessions"]);
const callLogsResource = makeResource("call_logs", ["call_logs"]);
const amocrmCallsResource = makeResource("amocrm_calls", ["amocrm_calls"]);
const settingListsResource = makeResource("setting_lists", ["setting_lists"]);
const rolePermissionsResource = makeResource("role_permissions", ["role_permissions"]);
const qualificationGroupsResource = makeResource("call_qualification_groups", [
  "call_qualification_groups",
]);
const qualificationCriteriaResource = makeResource("call_qualification_criteria", [
  "call_qualification_criteria",
]);
const callCategoriesResource = makeResource("call_categories", ["call_categories"]);
const callSkillsResource = makeResource("call_skills", ["call_skills"]);
const callStagesResource = makeResource("call_stages", ["call_stages"]);
const callStageStepsResource = makeResource("call_stage_steps", ["call_stage_steps"]);

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

export function useTaskComments(taskId: string | undefined) {
  return useQuery({
    queryKey: ["task_comments", taskId],
    enabled: !!taskId,
    queryFn: async (): Promise<TaskCommentRow[]> => {
      const { data, error } = await supabase
        .from("task_comments")
        .select("*")
        .eq("task_id", taskId!)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export function useCreateTaskComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      taskId: string;
      content: string;
      authorId: string | null;
    }): Promise<TaskCommentRow> => {
      const { data, error } = await supabase
        .from("task_comments")
        .insert({ task_id: input.taskId, content: input.content, author_id: input.authorId })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_data, vars) =>
      void qc.invalidateQueries({ queryKey: ["task_comments", vars.taskId] }),
  });
}

export const useProfilesRaw = (opts?: Parameters<typeof profilesResource.useList>[0]) =>
  profilesResource.useList({ orderBy: "full_name", ...opts });
export const useUpdateProfile = profilesResource.useUpdate;
export const useDeleteProfile = profilesResource.useRemove;

export const usePipelineStagesRaw = (opts?: Parameters<typeof stagesResource.useList>[0]) =>
  stagesResource.useList({ orderBy: "position", ...opts });
export const useCreateStage = stagesResource.useCreate;
export const useUpdateStage = stagesResource.useUpdate;
export const useDeleteStage = stagesResource.useRemove;

export const useWorkSessionsRaw = (opts?: Parameters<typeof workSessionsResource.useList>[0]) =>
  workSessionsResource.useList({ orderBy: "clock_in", ascending: false, ...opts });
export const useCreateWorkSession = workSessionsResource.useCreate;
export const useUpdateWorkSession = workSessionsResource.useUpdate;

export const useCallLogsRaw = (opts?: Parameters<typeof callLogsResource.useList>[0]) =>
  callLogsResource.useList({ orderBy: "created_at", ascending: false, ...opts });
export const useCreateCallLog = callLogsResource.useCreate;

export const useAmoCrmCallsRaw = (opts?: Parameters<typeof amocrmCallsResource.useList>[0]) =>
  amocrmCallsResource.useList({ orderBy: "occurred_at", ascending: false, ...opts });

export type SettingListType =
  | "categories"
  | "sales_stages"
  | "score_modifiers"
  | "skills"
  | "qualification_groups"
  | "lead_categories"
  | "conversion_targets";

/** One of the seven admin-managed named lists shown under Settings (categories, score modifiers, etc). */
export function useSettingList(listType: SettingListType) {
  const { data, ...rest } = settingListsResource.useList({ orderBy: "position" });
  const items = (data ?? []).filter((item) => item.list_type === listType);
  return { ...rest, data: items };
}
export const useCreateSettingListItem = settingListsResource.useCreate;
export const useUpdateSettingListItem = settingListsResource.useUpdate;
export const useDeleteSettingListItem = settingListsResource.useRemove;

/* ------------------------------------------------------------------ */
/* Qualification Groups: BANT-style weighted criteria, one group per   */
/* funnel/use-case.                                                    */
/* ------------------------------------------------------------------ */

export const useQualificationGroups = (
  opts?: Parameters<typeof qualificationGroupsResource.useList>[0],
) => qualificationGroupsResource.useList({ orderBy: "position", ...opts });
export const useCreateQualificationGroup = qualificationGroupsResource.useCreate;
export const useUpdateQualificationGroup = qualificationGroupsResource.useUpdate;
export const useDeleteQualificationGroup = qualificationGroupsResource.useRemove;

export const useQualificationCriteria = (
  opts?: Parameters<typeof qualificationCriteriaResource.useList>[0],
) => qualificationCriteriaResource.useList({ orderBy: "position", ...opts });
export const useCreateQualificationCriterion = qualificationCriteriaResource.useCreate;
export const useUpdateQualificationCriterion = qualificationCriteriaResource.useUpdate;
export const useDeleteQualificationCriterion = qualificationCriteriaResource.useRemove;

/* ------------------------------------------------------------------ */
/* Call-scoring rubric: Categories group Stages, Stages contain Steps, */
/* each Step optionally scores against a Skill (radar-chart axis).     */
/* ------------------------------------------------------------------ */

export const useCallCategories = (opts?: Parameters<typeof callCategoriesResource.useList>[0]) =>
  callCategoriesResource.useList({ orderBy: "position", ...opts });
export const useCreateCallCategory = callCategoriesResource.useCreate;
export const useUpdateCallCategory = callCategoriesResource.useUpdate;
export const useDeleteCallCategory = callCategoriesResource.useRemove;

export const useCallSkills = (opts?: Parameters<typeof callSkillsResource.useList>[0]) =>
  callSkillsResource.useList({ orderBy: "position", ...opts });
export const useCreateCallSkill = callSkillsResource.useCreate;
export const useUpdateCallSkill = callSkillsResource.useUpdate;
export const useDeleteCallSkill = callSkillsResource.useRemove;

export const useCallStagesRaw = (opts?: Parameters<typeof callStagesResource.useList>[0]) =>
  callStagesResource.useList({ orderBy: "position", ...opts });
export const useCreateCallStage = callStagesResource.useCreate;
export const useUpdateCallStage = callStagesResource.useUpdate;
export const useDeleteCallStage = callStagesResource.useRemove;

export const useCallStageStepsRaw = (opts?: Parameters<typeof callStageStepsResource.useList>[0]) =>
  callStageStepsResource.useList({ orderBy: "position", ...opts });
export const useCreateCallStageStep = callStageStepsResource.useCreate;
export const useUpdateCallStageStep = callStageStepsResource.useUpdate;
export const useDeleteCallStageStep = callStageStepsResource.useRemove;

export const useRolePermissions = (opts?: Parameters<typeof rolePermissionsResource.useList>[0]) =>
  rolePermissionsResource.useList(opts);
export const useUpdateRolePermission = rolePermissionsResource.useUpdate;
export const useCreateRolePermission = rolePermissionsResource.useCreate;

// Real enforcement, not just a stored preference: super_admin/platform_owner
// always pass; rop/sotuv_menejeri are gated by their row in role_permissions
// (see Huquqlar jadvali). No row for that action+role = denied, matching
// "unconfigured means no access" rather than silently allowing everything.
export function usePermission(action: string): boolean {
  const { user } = useAuth();
  const { data: permissions } = useRolePermissions();
  if (!user) return false;
  if (user.role === "super_admin" || user.role === "platform_owner") return true;
  return (permissions ?? []).some((p) => p.action === action && p.role === user.role && p.allowed);
}

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

// Which owner_id values the current user is allowed to see, for pages that
// scope leads/deals/calls to "your own data" (sotuv_menejeri) or "your
// team's data" (rop). Returns null for unrestricted roles (super_admin,
// platform_owner) — callers should treat null as "don't filter".
export function useVisibleOwnerIds(): Set<string> | null {
  const { user } = useAuth();
  const { data: profiles } = useProfilesRaw();
  return useMemo(() => {
    if (!user) return new Set<string>();
    if (user.role === "super_admin" || user.role === "platform_owner") return null;
    if (user.role === "rop") {
      const ids = new Set<string>([user.id]);
      for (const p of profiles ?? []) {
        if (p.manager_id === user.id) ids.add(p.id);
      }
      return ids;
    }
    // sotuv_menejeri (and any legacy role) only ever sees their own data.
    return new Set<string>([user.id]);
  }, [user, profiles]);
}

export function useCrmBase(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const companies = useCompaniesRaw({ enabled });
  const contacts = useContactsRaw({ enabled });
  const leads = useLeadsRaw({ enabled });
  const deals = useDealsRaw({ enabled });
  const stages = usePipelineStagesRaw({ enabled });
  const profiles = useProfilesRaw({ enabled });
  const visibleOwnerIds = useVisibleOwnerIds();

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

  // sotuv_menejeri only works their own pipeline; rop works their team's.
  // Managers/reps are gone as roles, but the same scoping now applies to
  // their replacements. Super admins keep the full, company-wide view.
  const scopedLeads = useMemo(
    () =>
      visibleOwnerIds
        ? (leads.data ?? []).filter((l) => !!l.owner_id && visibleOwnerIds.has(l.owner_id))
        : (leads.data ?? []),
    [leads.data, visibleOwnerIds],
  );
  const scopedDeals = useMemo(
    () =>
      visibleOwnerIds
        ? (deals.data ?? []).filter((d) => !!d.owner_id && visibleOwnerIds.has(d.owner_id))
        : (deals.data ?? []),
    [deals.data, visibleOwnerIds],
  );

  return {
    companies: companies.data ?? [],
    contacts: contacts.data ?? [],
    leads: scopedLeads,
    deals: scopedDeals,
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
  // Comparing `stage` (a free-text stage name) against the literal string
  // "Won"/"Lost" only works for the original demo-seeded stages — an
  // AmoCRM-synced stage keeps AmoCRM's own status name (e.g. "Успешно
  // реализовано"), so that comparison silently never matches for real
  // AmoCRM data. These come straight from pipeline_stages.is_won/is_lost
  // instead, which stay correct regardless of what the stage is named.
  stageIsWon: boolean;
  stageIsLost: boolean;
  funnel: string;
  nextFollowUp: string;
  lastContact: string;
  created: string;
  createdAtIso: string;
  updated: string;
  tags: string[];
  amocrmId: number | null;
};

// Shared lead-row -> display-view mapper, used by every hook that needs
// CrmLeadView shape: the full-org useCrmLeads() below, plus the lean
// single-lead and paginated-list hooks that don't fetch contacts at all
// (contact is optional there — its fields just come back blank, which is
// fine since the leads register table never renders them).
function leadRowToView(
  l: LeadRow,
  contact: ContactRow | null | undefined,
  profilesById: Map<string, ProfileRow>,
  stagesById: Map<string, StageRow>,
): CrmLeadView {
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
    stageIsWon: stage?.is_won ?? false,
    stageIsLost: stage?.is_lost ?? false,
    funnel: l.funnel ?? "",
    nextFollowUp: formatFollowUp(l.next_follow_up),
    lastContact: timeAgo(l.last_contact_at),
    created: formatDate(l.created_at),
    createdAtIso: l.created_at,
    updated: timeAgo(l.updated_at),
    tags: l.tags ?? [],
    amocrmId: l.amocrm_id,
  };
}

// overrideLeads lets callers substitute a reconstructed "as of a past date"
// snapshot (see useAsOfSnapshot) in place of the live leads table, while
// still joining against the current contacts/profiles/stages for display
// names — the same shape either way.
export function useCrmLeads(overrideLeads?: LeadRow[], options?: { enabled?: boolean }) {
  const base = useCrmBase(options);
  const visibleOwnerIds = useVisibleOwnerIds();
  // base.leads is already scoped, but an as-of-date override comes straight
  // from the (unscoped) audit trail — apply the same ownership filter to it
  // too, so time-travelling doesn't bypass the "own data only" restriction.
  const sourceLeads = useMemo(() => {
    if (!overrideLeads) return base.leads;
    return visibleOwnerIds
      ? overrideLeads.filter((l) => !!l.owner_id && visibleOwnerIds.has(l.owner_id))
      : overrideLeads;
  }, [overrideLeads, base.leads, visibleOwnerIds]);

  const rows = useMemo<CrmLeadView[]>(() => {
    const contactsById = byId(base.contacts);
    const profilesById = byId(base.profiles);
    const stagesById = byId(base.stages);

    return sourceLeads.map((l) =>
      leadRowToView(
        l,
        l.contact_id ? contactsById.get(l.contact_id) : undefined,
        profilesById,
        stagesById,
      ),
    );
  }, [sourceLeads, base.contacts, base.profiles, base.stages]);

  return { rows, ...base };
}

/* ------------------------------------------------------------------ */
/* View: a single lead by id — fetched directly instead of pulling the */
/* whole org's leads (useCrmLeads) just to .find() one of them. On a   */
/* large AmoCRM account this turned "open any one lead" into the same  */
/* multi-minute full-table fetch as the leads register itself. Applies */
/* the same owner/team visibility rule as useCrmBase (JS-layer, since   */
/* the leads SELECT RLS policy itself is org-wide) so a rep still can't */
/* open a teammate's lead by guessing its URL.                          */
/* ------------------------------------------------------------------ */

export function useLeadById(leadId: string | undefined) {
  const { data: stages } = usePipelineStagesRaw();
  const { data: profiles } = useProfilesRaw();
  const visibleOwnerIds = useVisibleOwnerIds();

  const query = useQuery({
    queryKey: ["lead_detail", leadId],
    enabled: !!leadId,
    queryFn: async (): Promise<{ lead: LeadRow; contact: ContactRow | null } | null> => {
      const { data: lead, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId!)
        .maybeSingle();
      if (error) throw error;
      if (!lead) return null;
      let contact: ContactRow | null = null;
      if (lead.contact_id) {
        const { data: c } = await supabase
          .from("contacts")
          .select("*")
          .eq("id", lead.contact_id)
          .maybeSingle();
        contact = c ?? null;
      }
      return { lead, contact };
    },
  });

  const lead = useMemo<CrmLeadView | undefined>(() => {
    const row = query.data?.lead;
    if (!row) return undefined;
    if (visibleOwnerIds && (!row.owner_id || !visibleOwnerIds.has(row.owner_id))) return undefined;
    return leadRowToView(row, query.data?.contact, byId(profiles), byId(stages));
  }, [query.data, visibleOwnerIds, profiles, stages]);

  return { lead, isLoading: query.isLoading };
}

/* ------------------------------------------------------------------ */
/* View: the leads register, paginated server-side. The register used  */
/* to call useCrmLeads() (the whole org's leads) and render every row   */
/* into one <table> with no pagination at all — on an account with tens */
/* of thousands of leads that meant transferring the entire table AND   */
/* rendering tens of thousands of DOM rows, the real cause of the page  */
/* freezing for minutes. Only the current page's rows are fetched now;  */
/* the summary stat cards come from a small SQL aggregate (leads_list_  */
/* stats) instead of being reduced over every row client-side.          */
/* ------------------------------------------------------------------ */

export type LeadsListParams = {
  page: number;
  pageSize?: number;
  search?: string;
  stageId?: string | null;
  sortDesc?: boolean;
  // ISO timestamps -- filters by created_at. Only applied to the page
  // query itself; the stats aggregate (leads_list_stats) stays all-time
  // since that RPC's definition doesn't live in this repo's migrations
  // (delivered as raw SQL directly, same as entities_as_of) and adding a
  // date param to it blind, without its real current source, risks
  // silently breaking it.
  from?: string | null;
  to?: string | null;
};

type LeadsListStats = { total: number; hot: number; avgScore: number; revenue: number };

export function useLeadsListPage(params: LeadsListParams) {
  const { user } = useAuth();
  const pageSize = params.pageSize ?? 50;
  const search = params.search?.trim() || null;
  const visibleOwnerIds = useVisibleOwnerIds();
  const ownerScopeKey = visibleOwnerIds ? [...visibleOwnerIds].sort().join(",") : null;
  const { data: stages } = usePipelineStagesRaw();
  const { data: profiles } = useProfilesRaw();

  const pageQuery = useQuery({
    queryKey: [
      "leads_list_page",
      user?.organizationId,
      params.page,
      pageSize,
      search,
      params.stageId ?? null,
      params.sortDesc ?? true,
      ownerScopeKey,
      params.from ?? null,
      params.to ?? null,
    ],
    enabled: !!user?.organizationId,
    queryFn: async (): Promise<LeadRow[]> => {
      const from = params.page * pageSize;
      let q = supabase.from("leads").select("*");
      if (params.stageId) q = q.eq("stage_id", params.stageId);
      if (search) q = q.or(`name.ilike.%${search}%,company_name.ilike.%${search}%`);
      if (visibleOwnerIds) q = q.in("owner_id", [...visibleOwnerIds]);
      if (params.from) q = q.gte("created_at", params.from);
      if (params.to) q = q.lte("created_at", params.to);
      q = q
        .order("score", { ascending: !(params.sortDesc ?? true) })
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as LeadRow[];
    },
  });

  const statsQuery = useQuery({
    queryKey: [
      "leads_list_stats",
      user?.organizationId,
      search,
      params.stageId ?? null,
      ownerScopeKey,
    ],
    enabled: !!user?.organizationId,
    queryFn: async (): Promise<LeadsListStats> => {
      const { data, error } = await supabase
        .rpc("leads_list_stats", {
          p_search: search,
          p_stage_id: params.stageId ?? null,
        })
        .maybeSingle();
      if (error) throw error;
      return {
        total: Number(data?.total ?? 0),
        hot: Number(data?.hot ?? 0),
        avgScore: Math.round(Number(data?.avg_score ?? 0)),
        revenue: Number(data?.revenue ?? 0),
      };
    },
  });

  const rows = useMemo<CrmLeadView[]>(() => {
    const stagesById = byId(stages);
    const profilesById = byId(profiles);
    return (pageQuery.data ?? []).map((l) => leadRowToView(l, undefined, profilesById, stagesById));
  }, [pageQuery.data, stages, profiles]);

  return {
    rows,
    stats: statsQuery.data ?? { total: 0, hot: 0, avgScore: 0, revenue: 0 },
    isLoading: pageQuery.isLoading || statsQuery.isLoading,
    isFetching: pageQuery.isFetching,
  };
}

/* ------------------------------------------------------------------ */
/* View: Pipeline board — one funnel's leads, fetched server-side      */
/* instead of pulling the whole organization's leads (useCrmBase) and  */
/* filtering client-side. Large AmoCRM accounts can have tens of       */
/* thousands of leads spread across dozens of funnels; loading all of  */
/* them just to show one funnel's Kanban board was the direct cause of */
/* the board never finishing "Pipeline yuklanmoqda...". contacts/      */
/* companies/deals aren't fetched at all here -- the board's cards only*/
/* need fields already denormalized onto leads (company_name, tags,    */
/* expected_revenue), not a contacts/companies join.                   */
/* ------------------------------------------------------------------ */

function usePipelineBoardLeadsRaw(funnel: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["pipeline_board_leads", user?.organizationId, funnel],
    enabled: !!user?.organizationId && !!funnel,
    queryFn: async (): Promise<LeadRow[]> => {
      const fetchPage = async (from: number): Promise<LeadRow[]> => {
        const { data, error } = await supabase
          .from("leads")
          .select("*")
          .eq("funnel", funnel!)
          .order("id", { ascending: true })
          .range(from, from + RESOURCE_PAGE_SIZE - 1);
        if (error) throw error;
        return (data ?? []) as LeadRow[];
      };

      const all: LeadRow[] = [];
      let from = 0;
      let done = false;
      while (!done) {
        const starts = Array.from(
          { length: LIST_PAGE_CONCURRENCY },
          (_, i) => from + i * RESOURCE_PAGE_SIZE,
        );
        const pages = await Promise.all(starts.map(fetchPage));
        for (const page of pages) {
          all.push(...page);
          if (page.length < RESOURCE_PAGE_SIZE) done = true;
        }
        from += LIST_PAGE_CONCURRENCY * RESOURCE_PAGE_SIZE;
      }
      return all;
    },
  });
}

/** Same shape as useCrmLeads, scoped to a single funnel and fetched server-side — see the comment above usePipelineBoardLeadsRaw for why. */
export function usePipelineBoardLeads(funnel: string | null) {
  const board = usePipelineBoardLeadsRaw(funnel);
  const { data: stages } = usePipelineStagesRaw();
  const { data: profiles } = useProfilesRaw();
  const visibleOwnerIds = useVisibleOwnerIds();

  const scopedLeads = useMemo(() => {
    const leads = board.data ?? [];
    return visibleOwnerIds
      ? leads.filter((l) => !!l.owner_id && visibleOwnerIds.has(l.owner_id))
      : leads;
  }, [board.data, visibleOwnerIds]);

  const rows = useMemo<CrmLeadView[]>(() => {
    const profilesById = byId(profiles ?? []);
    const stagesById = byId(stages ?? []);

    return scopedLeads.map((l): CrmLeadView => {
      const owner = l.owner_id ? profilesById.get(l.owner_id) : undefined;
      const manager = l.manager_id ? profilesById.get(l.manager_id) : undefined;
      const stage = l.stage_id ? stagesById.get(l.stage_id) : undefined;
      return {
        id: l.id,
        name: l.name,
        initials: initialsOf(l.name),
        company: l.company_name,
        companyId: l.company_id ?? "",
        position: "",
        phone: "",
        altPhone: "",
        email: "",
        telegram: "",
        whatsapp: "",
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
        stageIsWon: stage?.is_won ?? false,
        stageIsLost: stage?.is_lost ?? false,
        funnel: l.funnel ?? "",
        nextFollowUp: formatFollowUp(l.next_follow_up),
        lastContact: timeAgo(l.last_contact_at),
        created: formatDate(l.created_at),
        createdAtIso: l.created_at,
        updated: timeAgo(l.updated_at),
        tags: l.tags ?? [],
        amocrmId: l.amocrm_id,
      };
    });
  }, [scopedLeads, profiles, stages]);

  return {
    rows,
    stages: stages ?? [],
    isLoading: board.isLoading || !stages || !profiles,
    isError: board.isError,
  };
}

/* ------------------------------------------------------------------ */
/* View: Funnels list -- one row per funnel, aggregated server-side.   */
/* The /funnels page (no funnel selected) used to pull the whole org's */
/* leads via useCrmLeads() just to group them into cards -- same full- */
/* table problem as everywhere else on a large AmoCRM account.         */
/* ------------------------------------------------------------------ */

export type FunnelStat = {
  name: string;
  count: number;
  value: number;
  won: number;
  hot: number;
  warm: number;
  cold: number;
  conversion: number;
};

export function useFunnelListStats(enabled = true) {
  const { user } = useAuth();
  const enabledFunnels = useEnabledFunnelNames();
  const query = useQuery({
    queryKey: ["funnel_list_stats", user?.organizationId],
    enabled: enabled && !!user?.organizationId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("funnel_list_stats");
      if (error) throw error;
      return data ?? [];
    },
  });

  const funnels = useMemo<FunnelStat[]>(
    () =>
      (query.data ?? [])
        .filter((r) => !enabledFunnels || enabledFunnels.has(r.funnel))
        .map((r): FunnelStat => {
          const count = Number(r.total);
          const won = Number(r.won);
          return {
            name: r.funnel,
            count,
            value: Number(r.value),
            won,
            hot: Number(r.hot),
            warm: Number(r.warm),
            cold: Number(r.cold),
            conversion: count ? Math.round((won / count) * 1000) / 10 : 0,
          };
        })
        .sort((a, b) => b.count - a.count),
    [query.data, enabledFunnels],
  );

  return { funnels, isLoading: query.isLoading };
}

/* ------------------------------------------------------------------ */
/* View: Leaderboard (real per-manager performance, not simulated)     */
/* ------------------------------------------------------------------ */

export type LeaderboardFilters = {
  from: string | null;
  to: string | null;
  search: string;
  stageId: string | null;
  funnel: string | null;
  tags: string[];
};

export type LeaderboardManagerRow = {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  totalLeads: number;
  wonLeads: number;
  lostLeads: number;
  revenue: number;
  conversion: number;
  kpiPercent: number;
  monthlyTarget: number;
  targetCompletion: number;
};

type LeaderboardOwnerStats = { total: number; won: number; lost: number; revenue: number };

// Live path (the overwhelming majority of calls, including the 3s "live"
// poll on the Reyting landing page) used to re-fetch the whole org's leads
// table -- tens of thousands of rows on a large AmoCRM account -- on every
// poll tick, forever, for as long as the tab stayed open. leaderboard_stats
// computes the same per-owner totals in Postgres and returns one row per
// rep instead. The as-of-date override path (opts.overrideLeads) still
// reduces client-side, since that snapshot only exists in memory (it comes
// from the audit trail, not the live table) and is small by nature.
export function useLeaderboardView(
  filters: LeaderboardFilters,
  opts?: { refetchInterval?: number | false; overrideLeads?: LeadRow[] | undefined },
) {
  const refetchInterval = opts?.refetchInterval ?? false;
  const useOverride = !!opts?.overrideLeads;

  const {
    data: profiles,
    isLoading: profilesLoading,
    isFetching: profilesFetching,
    refetch: refetchProfiles,
  } = useProfilesRaw({ refetchInterval });
  const {
    data: stages,
    isLoading: stagesLoading,
    isFetching: stagesFetching,
    refetch: refetchStages,
  } = usePipelineStagesRaw({ refetchInterval });
  const stagesById = useMemo(() => byId(stages), [stages]);

  const tagsKey = filters.tags.length ? [...filters.tags].sort().join(",") : "";
  const statsQuery = useQuery({
    queryKey: [
      "leaderboard_stats",
      filters.from,
      filters.to,
      filters.funnel,
      filters.stageId,
      tagsKey,
    ],
    enabled: !useOverride,
    refetchInterval: useOverride ? false : refetchInterval,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("leaderboard_stats", {
        p_from: filters.from,
        p_to: filters.to,
        p_funnel: filters.funnel,
        p_stage_id: filters.stageId,
        p_tags: filters.tags.length ? filters.tags : null,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filteredOverrideLeads = useMemo(() => {
    if (!useOverride) return [];
    return (opts?.overrideLeads ?? []).filter((l) => {
      if (filters.from && l.created_at < filters.from) return false;
      if (filters.to && l.created_at > filters.to) return false;
      if (filters.stageId && l.stage_id !== filters.stageId) return false;
      if (filters.funnel && (l.funnel || "Direct Sales") !== filters.funnel) return false;
      if (filters.tags.length > 0 && !filters.tags.some((tag) => (l.tags ?? []).includes(tag)))
        return false;
      return true;
    });
  }, [
    useOverride,
    opts?.overrideLeads,
    filters.from,
    filters.to,
    filters.stageId,
    filters.funnel,
    filters.tags,
  ]);

  const statsByOwner = useMemo(() => {
    const map = new Map<string, LeaderboardOwnerStats>();
    if (useOverride) {
      for (const l of filteredOverrideLeads) {
        if (!l.owner_id) continue;
        const entry = map.get(l.owner_id) ?? { total: 0, won: 0, lost: 0, revenue: 0 };
        entry.total += 1;
        const stage = l.stage_id ? stagesById.get(l.stage_id) : undefined;
        if (stage?.is_won) {
          entry.won += 1;
          entry.revenue += l.expected_revenue;
        }
        if (stage?.is_lost) entry.lost += 1;
        map.set(l.owner_id, entry);
      }
    } else {
      for (const r of statsQuery.data ?? []) {
        map.set(r.owner_id, {
          total: Number(r.total_leads),
          won: Number(r.won_leads),
          lost: Number(r.lost_leads),
          revenue: Number(r.revenue),
        });
      }
    }
    return map;
  }, [useOverride, filteredOverrideLeads, stagesById, statsQuery.data]);

  const isLoading = useOverride
    ? profilesLoading || stagesLoading
    : profilesLoading || stagesLoading || statsQuery.isLoading;
  const isFetching = useOverride
    ? profilesFetching || stagesFetching
    : profilesFetching || stagesFetching || statsQuery.isFetching;
  const refetch = () =>
    Promise.all([refetchProfiles(), refetchStages(), useOverride ? null : statsQuery.refetch()]);

  const rows = useMemo<LeaderboardManagerRow[]>(() => {
    const q = filters.search.trim().toLowerCase();
    const eligible = (profiles ?? []).filter(
      (p) =>
        p.role !== "super_admin" &&
        p.role !== "platform_owner" &&
        p.role !== "rop" &&
        (!q || profileName(p).toLowerCase().includes(q)),
    );
    return eligible
      .map((p): LeaderboardManagerRow => {
        const s = statsByOwner.get(p.id) ?? { total: 0, won: 0, lost: 0, revenue: 0 };
        const conversion = s.total ? (s.won / s.total) * 100 : 0;
        const targetCompletion = p.monthly_target > 0 ? (s.revenue / p.monthly_target) * 100 : 0;
        return {
          id: p.id,
          name: profileName(p),
          initials: initialsOf(profileName(p)),
          avatarUrl: p.avatar_url,
          totalLeads: s.total,
          wonLeads: s.won,
          lostLeads: s.lost,
          revenue: s.revenue,
          conversion,
          kpiPercent: p.kpi_percent,
          monthlyTarget: p.monthly_target,
          targetCompletion,
        };
      })
      .filter((row) => !filters.funnel || row.totalLeads > 0)
      .sort((a, b) => b.revenue - a.revenue);
  }, [profiles, statsByOwner, filters.search, filters.funnel]);

  return {
    rows,
    isLoading,
    isFetching,
    refetch,
    dataUpdatedAt: statsQuery.dataUpdatedAt,
  };
}

/* ------------------------------------------------------------------ */
/* View: Audio Analytics (real AmoCRM call activity). Transcript + AI       */
/* summary are populated on demand via useAnalyzeCall(), which needs both  */
/* OPENAI_API_KEY (transcription) and DEEPSEEK_API_KEY (summary) set.      */
/* ------------------------------------------------------------------ */

export type CallChecklistItem = {
  stage: string;
  step: string;
  skill: string | null;
  points: number;
  met: boolean;
  note: string;
};

export type ServiceStandardCheck = {
  name: string;
  violated: boolean;
  evidence: string;
};

export type CallAnalysis = {
  checklist: CallChecklistItem[];
  strengths: string[];
  improvements: string[];
  warnings: string[];
  risks: string[];
  agreements: string[];
  keyQuotes: string[];
  topObjections: string[];
  serviceStandards: ServiceStandardCheck[];
};

export type AudioCallView = {
  id: string;
  leadId: string | null;
  leadName: string;
  company: string;
  owner: string;
  ownerId: string | null;
  funnel: string | null;
  stage: string | null;
  phone: string;
  direction: "in" | "out";
  connected: boolean;
  durationSeconds: number;
  recordingUrl: string | null;
  occurredAt: string;
  occurredAtRaw: string;
  transcript: string | null;
  aiSummary: string | null;
  nextStep: string | null;
  amocrmTaskId: number | null;
  amocrmId: number | null;
  score: number | null;
  mood: string | null;
  talkRatio: number | null;
  analysis: CallAnalysis | null;
};

export type RecoverableLeadView = {
  id: string;
  name: string;
  company: string;
  owner: string;
  tags: string[];
  lastCallAt: string;
  connectedCalls: number;
  amocrmId: number | null;
};

type AudioLeadLite = {
  id: string;
  name: string;
  company: string;
  ownerId: string;
  owner: string;
  funnel: string;
  stage: string;
  tags: string[];
  amocrmId: number | null;
};

export function useAudioAnalyticsView(overrideCalls?: AmoCrmCallRow[]) {
  const { user } = useAuth();
  const { data: liveCalls, isLoading: callsLoading } = useAmoCrmCallsRaw();
  // Only the handful of display fields below (name/company/owner/funnel/
  // stage/tags) are needed here — useCrmLeads() used to pull this via
  // useCrmBase, which also fetched every company and contact in the org
  // (unused on this page) plus ran the full CrmLeadView join per lead. On a
  // large AmoCRM account that made "open Audio tahlil" pay the same
  // multi-thousand-row cost as the leads register itself. Build the lookup
  // straight from the lighter raw tables instead.
  const { data: rawLeads, isLoading: rawLeadsLoading } = useLeadsRaw();
  const { data: profiles, isLoading: profilesLoading } = useProfilesRaw();
  const { data: stages, isLoading: stagesLoading } = usePipelineStagesRaw();
  const visibleOwnerIds = useVisibleOwnerIds();
  const isLoading = callsLoading || rawLeadsLoading || profilesLoading || stagesLoading;

  const leads = useMemo<AudioLeadLite[]>(() => {
    const profilesById = byId(profiles);
    const stagesById = byId(stages);
    const scoped = visibleOwnerIds
      ? (rawLeads ?? []).filter((l) => !!l.owner_id && visibleOwnerIds.has(l.owner_id))
      : (rawLeads ?? []);
    return scoped.map((l) => {
      const owner = l.owner_id ? profilesById.get(l.owner_id) : undefined;
      const stage = l.stage_id ? stagesById.get(l.stage_id) : undefined;
      return {
        id: l.id,
        name: l.name,
        company: l.company_name,
        ownerId: l.owner_id ?? "",
        owner: owner ? profileName(owner) : "Unassigned",
        funnel: l.funnel ?? "",
        stage: stage?.name ?? "New Lead",
        tags: l.tags ?? [],
        amocrmId: l.amocrm_id,
      };
    });
  }, [rawLeads, profiles, stages, visibleOwnerIds]);

  const leadsById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);

  // leads (from useCrmLeads) are already scoped to what this user may see —
  // a call whose lead isn't in that map belongs to someone else's lead and
  // must be hidden too (call metadata, recordings and transcripts included).
  // A call with no lead_id at all (a manual log) is only visible to whoever
  // created it, for the same roles.
  const calls = useMemo(() => {
    const rows = overrideCalls ?? liveCalls ?? [];
    if (!user) return [];
    if (user.role === "super_admin" || user.role === "platform_owner") return rows;
    return rows.filter((c) => (c.lead_id ? leadsById.has(c.lead_id) : c.created_by === user.id));
  }, [overrideCalls, liveCalls, leadsById, user]);

  const recent = useMemo<AudioCallView[]>(
    () =>
      (calls ?? []).map((c) => {
        const lead = c.lead_id ? leadsById.get(c.lead_id) : undefined;
        return {
          id: c.id,
          leadId: c.lead_id,
          leadName: lead?.name ?? "",
          company: lead?.company ?? "",
          owner: lead?.owner ?? "",
          ownerId: lead?.ownerId ?? null,
          // Leads with no funnel set display as "Direct Sales" everywhere
          // else (funnel dropdown, LeadFilterBar) — match that fallback here
          // too, or a call attached to one of those leads never matches the
          // "Direct Sales" filter option and silently vanishes from results.
          funnel: lead ? lead.funnel || "Direct Sales" : null,
          stage: lead?.stage ?? null,
          // A lead's own phone lives on its linked contact, which this view
          // no longer fetches (see the lite-lookup comment above) — fall
          // back to the call's own phone only.
          phone: c.phone ?? "",
          direction: c.direction === "in" ? "in" : "out",
          connected: c.connected,
          durationSeconds: c.duration_seconds,
          recordingUrl: c.recording_url,
          occurredAt: timeAgo(c.occurred_at),
          occurredAtRaw: c.occurred_at,
          transcript: c.transcript,
          aiSummary: c.ai_summary,
          nextStep: c.next_step,
          amocrmTaskId: c.amocrm_task_id,
          amocrmId: lead?.amocrmId ?? null,
          score: c.score,
          mood: c.mood,
          talkRatio: c.talk_ratio,
          analysis: (c.analysis as CallAnalysis | null) ?? null,
        };
      }),
    [calls, leadsById],
  );

  const totals = useMemo(() => {
    const total = calls?.length ?? 0;
    const connected = (calls ?? []).filter((c) => c.connected).length;
    const totalDuration = (calls ?? []).reduce((s, c) => s + c.duration_seconds, 0);
    const avgDuration = total ? Math.round(totalDuration / total) : 0;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const callsToday = (calls ?? []).filter((c) => new Date(c.occurred_at) >= startOfToday).length;
    return {
      total,
      connected,
      connectionRate: total ? Math.round((connected / total) * 1000) / 10 : 0,
      avgDuration,
      callsToday,
    };
  }, [calls]);

  const perRep = useMemo(() => {
    const map = new Map<
      string,
      { name: string; calls: number; connected: number; duration: number }
    >();
    // Seed every rep who owns at least one visible lead first, so a rep with
    // zero calls synced yet still shows up (at 0) instead of silently
    // disappearing from the breakdown.
    for (const l of leads) {
      if (!l.ownerId) continue;
      if (!map.has(l.ownerId)) {
        map.set(l.ownerId, { name: l.owner, calls: 0, connected: 0, duration: 0 });
      }
    }
    for (const c of calls ?? []) {
      const lead = c.lead_id ? leadsById.get(c.lead_id) : undefined;
      const key = lead?.ownerId || "unknown";
      const name = lead?.owner || "—";
      if (!map.has(key)) map.set(key, { name, calls: 0, connected: 0, duration: 0 });
      const row = map.get(key)!;
      row.calls += 1;
      if (c.connected) row.connected += 1;
      row.duration += c.duration_seconds;
    }
    return Array.from(map.values()).sort((a, b) => b.calls - a.calls);
  }, [calls, leadsById, leads]);

  const recoverable = useMemo<RecoverableLeadView[]>(() => {
    const callsByLead = new Map<string, AmoCrmCallRow[]>();
    for (const c of calls ?? []) {
      if (!c.lead_id) continue;
      if (!callsByLead.has(c.lead_id)) callsByLead.set(c.lead_id, []);
      callsByLead.get(c.lead_id)!.push(c);
    }
    return leads
      .filter((l) => l.stage === "Lost")
      .map((l) => {
        const leadCalls = callsByLead.get(l.id) ?? [];
        const connectedCalls = leadCalls.filter((c) => c.connected).length;
        const last = [...leadCalls].sort(
          (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
        )[0];
        return {
          id: l.id,
          name: l.name,
          company: l.company,
          owner: l.owner,
          tags: l.tags,
          lastCallAt: last ? timeAgo(last.occurred_at) : "",
          connectedCalls,
          amocrmId: l.amocrmId,
        };
      })
      .filter((l) => l.connectedCalls > 0)
      .sort((a, b) => b.connectedCalls - a.connectedCalls)
      .slice(0, 10);
  }, [leads, calls]);

  return { recent, totals, perRep, recoverable, isLoading };
}

// A small, cheap preview for widgets (Dashboard's Audio tahlil card) that
// only need "the last few AI-scored calls" — not the full useAudioAnalyticsView
// (every call, every column, for the whole org). Filtering server-side on
// score IS NOT NULL keeps this to the small analyzed subset instead of the
// whole calls table.
export type RecentAnalyzedCall = {
  id: string;
  leadId: string | null;
  leadName: string;
  score: number;
  mood: string | null;
  nextStep: string | null;
  occurredAt: string;
};

type CallScorePreviewRow = {
  id: string;
  lead_id: string | null;
  occurred_at: string;
  score: number | null;
  mood: string | null;
  next_step: string | null;
};

export function useRecentAnalyzedCalls(funnel: string | null, limit = 5) {
  const { user } = useAuth();
  const { data: leads } = useLeadsRaw();
  const visibleOwnerIds = useVisibleOwnerIds();
  const leadsById = useMemo(() => byId(leads), [leads]);

  const needsScoping = !!funnel || !!visibleOwnerIds;
  const scopedLeadIds = useMemo(() => {
    if (!needsScoping) return null;
    return (leads ?? [])
      .filter((l) => {
        if (funnel && (l.funnel || "Direct Sales") !== funnel) return false;
        if (visibleOwnerIds && (!l.owner_id || !visibleOwnerIds.has(l.owner_id))) return false;
        return true;
      })
      .map((l) => l.id);
  }, [leads, funnel, visibleOwnerIds, needsScoping]);
  const scopeKey = scopedLeadIds ? scopedLeadIds.slice().sort().join(",") : null;

  const query = useQuery({
    queryKey: ["recent-analyzed-calls", limit, funnel ?? null, scopeKey],
    enabled: !!user && (!needsScoping || leads !== undefined),
    queryFn: async (): Promise<CallScorePreviewRow[]> => {
      if (scopedLeadIds && scopedLeadIds.length === 0) return [];
      let q = supabase
        .from("amocrm_calls")
        .select("id, lead_id, occurred_at, score, mood, next_step")
        .not("score", "is", null);
      if (scopedLeadIds) q = q.in("lead_id", scopedLeadIds);
      const { data, error } = await q.order("occurred_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as CallScorePreviewRow[];
    },
  });

  const rows = useMemo<RecentAnalyzedCall[]>(
    () =>
      (query.data ?? []).map((c) => ({
        id: c.id,
        leadId: c.lead_id,
        leadName: (c.lead_id ? leadsById.get(c.lead_id)?.name : null) ?? "—",
        score: c.score!,
        mood: c.mood,
        nextStep: c.next_step,
        occurredAt: timeAgo(c.occurred_at),
      })),
    [query.data, leadsById],
  );

  return { rows, isLoading: query.isLoading };
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
  // null when the task has no linked lead (e.g. Important Tasks' general,
  // non-lead-specific items) — those are funnel-agnostic by definition.
  funnel: string | null;
};

export function useTasksView(overrideTasks?: TaskRow[]) {
  const tasks = useTasksRaw();
  const profiles = useProfilesRaw();
  const leads = useLeadsRaw();
  const visibleOwnerIds = useVisibleOwnerIds();
  const sourceTasks = useMemo(() => {
    const rows = overrideTasks ?? tasks.data ?? [];
    return visibleOwnerIds
      ? rows.filter((t) => t.assignee_id && visibleOwnerIds.has(t.assignee_id))
      : rows;
  }, [overrideTasks, tasks.data, visibleOwnerIds]);

  const rows = useMemo<TaskView[]>(() => {
    const profilesById = byId(profiles.data);
    const leadsById = byId(leads.data);
    return (sourceTasks ?? []).map((t): TaskView => {
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
        funnel: lead ? lead.funnel || "Direct Sales" : null,
      };
    });
  }, [sourceTasks, profiles.data, leads.data]);

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
  const visibleOwnerIds = useVisibleOwnerIds();

  return useMemo(() => {
    const rows = visibleOwnerIds
      ? (deals ?? []).filter((d) => !!d.owner_id && visibleOwnerIds.has(d.owner_id))
      : (deals ?? []);
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
  }, [deals, visibleOwnerIds]);
}

export type SalesAnalyticsSummary = {
  forecast: number;
  ytdRevenue: number;
  ytdDelta: number;
  avgDealSize: number;
  lossRate: number;
  lossRateDelta: number;
  monthlyTrend: { label: string; revenue: number }[];
  perOwner: { name: string; revenue: number }[];
};

// Real-data replacement for the old static "Sales Analytics" mock page --
// same four headline numbers and two charts, computed straight from leads
// + pipeline_stages (this AmoCRM-synced setup never populates the deals
// table, so useRevenueSeries above would just read zeros here).
export function useSalesAnalyticsSummary(funnel?: string | null): SalesAnalyticsSummary {
  const { data: leads } = useLeadsRaw();
  const { data: stages } = usePipelineStagesRaw();
  const { data: profiles } = useProfilesRaw();

  return useMemo(() => {
    const stagesById = byId(stages);
    const profilesById = byId(profiles);
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const oneEightyDaysAgo = new Date(now);
    oneEightyDaysAgo.setDate(oneEightyDaysAgo.getDate() - 180);

    let forecast = 0;
    let ytdRevenue = 0;
    let lastYearRevenue = 0;
    const dealSizes90d: number[] = [];
    let recentLost = 0;
    let recentClosed = 0;
    let prevLost = 0;
    let prevClosed = 0;
    const revenueByOwner = new Map<string, number>();
    const monthlyRevenue = new Map<string, number>();

    for (const l of leads ?? []) {
      const leadFunnel = l.funnel || "Direct Sales";
      if (funnel && leadFunnel !== funnel) continue;
      const stage = l.stage_id ? stagesById.get(l.stage_id) : undefined;
      const createdAt = new Date(l.created_at);
      const revenue = l.expected_revenue;

      if (stage && !stage.is_won && !stage.is_lost) {
        forecast += revenue * (stage.probability / 100);
      }

      if (stage?.is_won) {
        if (createdAt >= yearStart) ytdRevenue += revenue;
        else if (createdAt >= lastYearStart && createdAt < yearStart) lastYearRevenue += revenue;
        if (createdAt >= ninetyDaysAgo) dealSizes90d.push(revenue);

        const owner = l.owner_id ? profilesById.get(l.owner_id) : undefined;
        const ownerName = profileName(owner);
        revenueByOwner.set(ownerName, (revenueByOwner.get(ownerName) ?? 0) + revenue);

        const key = monthKey(l.created_at);
        monthlyRevenue.set(key, (monthlyRevenue.get(key) ?? 0) + revenue);
      }

      if (stage?.is_won || stage?.is_lost) {
        if (createdAt >= ninetyDaysAgo) {
          recentClosed += 1;
          if (stage.is_lost) recentLost += 1;
        } else if (createdAt >= oneEightyDaysAgo) {
          prevClosed += 1;
          if (stage.is_lost) prevLost += 1;
        }
      }
    }

    const avgDealSize = dealSizes90d.length
      ? dealSizes90d.reduce((s, v) => s + v, 0) / dealSizes90d.length
      : 0;
    const ytdDelta =
      lastYearRevenue > 0 ? ((ytdRevenue - lastYearRevenue) / lastYearRevenue) * 100 : 0;
    const lossRate = recentClosed ? (recentLost / recentClosed) * 100 : 0;
    const prevLossRate = prevClosed ? (prevLost / prevClosed) * 100 : 0;

    const monthlyTrend: { label: string; revenue: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      monthlyTrend.push({
        label: MONTH_LABELS[d.getMonth()]!,
        revenue: monthlyRevenue.get(key) ?? 0,
      });
    }

    // Used to show only the first word of the name (assuming a western
    // "First Last" pattern) to keep chart labels short — but this org's
    // rep names follow a "Rus tili 117 | Fotima Axmedova" convention, so
    // every rep starting with "Rus tili ..." collapsed to the identical
    // label "Rus" on the chart. Keep the full name; RevenueByOwnerChart's
    // XAxis truncates long labels itself.
    const perOwner = Array.from(revenueByOwner.entries())
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);

    return {
      forecast,
      ytdRevenue,
      ytdDelta,
      avgDealSize,
      lossRate,
      lossRateDelta: lossRate - prevLossRate,
      monthlyTrend,
      perOwner,
    };
  }, [leads, stages, profiles, funnel]);
}

export type LostReasonBucket = { reason: string; count: number };

// AmoCRM's own "Причина отказа" (loss reason) catalog, synced onto
// leads.loss_reason -- real data that until now was only surfaced deep
// inside Lead Analytics' Yo'nalish tab, not on the Dashboard itself.
export function useLostReasonsSummary(funnel?: string | null): LostReasonBucket[] {
  const { data: leads } = useLeadsRaw();
  const { data: stages } = usePipelineStagesRaw();

  return useMemo(() => {
    const stagesById = byId(stages);
    const counts = new Map<string, number>();
    for (const l of leads ?? []) {
      const leadFunnel = l.funnel || "Direct Sales";
      if (funnel && leadFunnel !== funnel) continue;
      const stage = l.stage_id ? stagesById.get(l.stage_id) : undefined;
      if (!stage?.is_lost) continue;
      const reason = l.loss_reason?.trim() || "—";
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([reason, count]): LostReasonBucket => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [leads, stages, funnel]);
}

// ISO 8601 week number (Monday-start, week 1 = the week containing the
// year's first Thursday) -- the standard definition, matching what "W31",
// "W32" etc. conventionally mean.
function isoWeekLabel(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `W${weekNo}`;
}

export type DealFlowWeek = {
  week: string;
  created: number;
  won: number;
  lost: number;
  revenue: number;
};

/* ------------------------------------------------------------------ */
/* Dashboard — "Sotuv dinamikasi": weekly deal flow (created vs. their   */
/* current won/lost outcome) plus revenue. Since there's no per-lead     */
/* stage-visit history in this schema (same limitation as the daily      */
/* report's biggestStageDrop), "won this week"/"lost this week" really   */
/* means "created this week, and currently sitting in a won/lost stage"  */
/* -- a cohort-outcome view, not a true week-by-week transition ledger.  */
/* ------------------------------------------------------------------ */
export function useDealFlowWeekly(funnel: string | null, weeks = 8): DealFlowWeek[] {
  const { data: leads } = useLeadsRaw();
  const { data: stages } = usePipelineStagesRaw();

  return useMemo(() => {
    const stagesById = byId(stages);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - weeks * 7);

    const byWeek = new Map<
      string,
      { created: number; won: number; lost: number; revenue: number; weekStart: Date }
    >();

    for (const l of leads ?? []) {
      const leadFunnel = l.funnel || "Direct Sales";
      if (funnel && leadFunnel !== funnel) continue;
      const createdAt = new Date(l.created_at);
      if (createdAt < cutoff) continue;
      const stage = l.stage_id ? stagesById.get(l.stage_id) : undefined;
      const label = isoWeekLabel(createdAt);
      const bucket = byWeek.get(label) ?? {
        created: 0,
        won: 0,
        lost: 0,
        revenue: 0,
        weekStart: createdAt,
      };
      bucket.created += 1;
      if (stage?.is_won) {
        bucket.won += 1;
        bucket.revenue += l.expected_revenue;
      } else if (stage?.is_lost) {
        bucket.lost += 1;
      }
      if (createdAt < bucket.weekStart) bucket.weekStart = createdAt;
      byWeek.set(label, bucket);
    }

    return Array.from(byWeek.entries())
      .sort((a, b) => a[1].weekStart.getTime() - b[1].weekStart.getTime())
      .map(([week, b]) => ({
        week,
        created: b.created,
        won: b.won,
        lost: b.lost,
        revenue: b.revenue,
      }));
  }, [leads, stages, funnel, weeks]);
}

export type ConversionQualityWeek = {
  week: string;
  conversionPct: number | null;
  inRangePct: number | null;
};

/* ------------------------------------------------------------------ */
/* Dashboard — "Konversiya va qo'ng'iroq sifati": does a higher share of */
/* good-scoring calls in a week line up with a higher conversion rate    */
/* for leads created that week? Correlation is Pearson's r over the      */
/* weeks where both series have a value.                                 */
/* ------------------------------------------------------------------ */
export function useConversionQualityWeekly(
  funnel: string | null,
  scoreMin: number,
  scoreMax: number,
  weeks = 12,
): { rows: ConversionQualityWeek[]; correlation: number | null } {
  const { data: leads } = useLeadsRaw();
  const { data: stages } = usePipelineStagesRaw();
  const { data: calls } = useAmoCrmCallsRaw();

  return useMemo(() => {
    const stagesById = byId(stages);
    const leadsById = byId(leads);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - weeks * 7);

    type Bucket = {
      created: number;
      won: number;
      totalCalls: number;
      inRangeCalls: number;
      weekStart: Date;
    };
    const byWeek = new Map<string, Bucket>();
    const bucketFor = (label: string, start: Date): Bucket => {
      let b = byWeek.get(label);
      if (!b) {
        b = { created: 0, won: 0, totalCalls: 0, inRangeCalls: 0, weekStart: start };
        byWeek.set(label, b);
      }
      return b;
    };

    for (const l of leads ?? []) {
      const leadFunnel = l.funnel || "Direct Sales";
      if (funnel && leadFunnel !== funnel) continue;
      const createdAt = new Date(l.created_at);
      if (createdAt < cutoff) continue;
      const stage = l.stage_id ? stagesById.get(l.stage_id) : undefined;
      const b = bucketFor(isoWeekLabel(createdAt), createdAt);
      b.created += 1;
      if (stage?.is_won) b.won += 1;
    }

    for (const c of calls ?? []) {
      if (c.score == null) continue;
      const lead = c.lead_id ? leadsById.get(c.lead_id) : undefined;
      const leadFunnel = lead ? lead.funnel || "Direct Sales" : null;
      if (funnel && leadFunnel !== funnel) continue;
      const occurredAt = new Date(c.occurred_at);
      if (occurredAt < cutoff) continue;
      const b = bucketFor(isoWeekLabel(occurredAt), occurredAt);
      b.totalCalls += 1;
      if (c.score >= scoreMin && c.score <= scoreMax) b.inRangeCalls += 1;
    }

    const rows = Array.from(byWeek.entries())
      .sort((a, b) => a[1].weekStart.getTime() - b[1].weekStart.getTime())
      .map(([week, b]) => ({
        week,
        conversionPct: b.created > 0 ? Math.round((b.won / b.created) * 1000) / 10 : null,
        inRangePct:
          b.totalCalls > 0 ? Math.round((b.inRangeCalls / b.totalCalls) * 1000) / 10 : null,
      }));

    const pairs = rows.filter(
      (r): r is { week: string; conversionPct: number; inRangePct: number } =>
        r.conversionPct != null && r.inRangePct != null,
    );
    let correlation: number | null = null;
    if (pairs.length >= 2) {
      const xs = pairs.map((p) => p.conversionPct);
      const ys = pairs.map((p) => p.inRangePct);
      const n = xs.length;
      const meanX = xs.reduce((s, v) => s + v, 0) / n;
      const meanY = ys.reduce((s, v) => s + v, 0) / n;
      let num = 0;
      let denX = 0;
      let denY = 0;
      for (let i = 0; i < n; i++) {
        const dx = xs[i]! - meanX;
        const dy = ys[i]! - meanY;
        num += dx * dy;
        denX += dx * dx;
        denY += dy * dy;
      }
      const den = Math.sqrt(denX * denY);
      correlation = den > 0 ? Math.round((num / den) * 100) / 100 : null;
    }

    return { rows, correlation };
  }, [leads, stages, calls, funnel, scoreMin, scoreMax, weeks]);
}

/* ------------------------------------------------------------------ */
/* Kunlik/Haftalik/Oylik hisobot (Boshqaruv paneli's report section) — */
/* a single period-scoped aggregate over leads/calls/stages, all       */
/* already cached elsewhere in the app. Mirrors the "biggest picture"  */
/* daily-report tools like metrixme produce, computed from our own     */
/* real CRM data rather than a separate reporting backend.             */
/* ------------------------------------------------------------------ */

export type DailyReportScope = {
  funnel: string | null;
  teamId: string | null; // a ROP's profile id -- scopes to their whole team
  operatorId: string | null; // a single manager's profile id
};

export type DailyReportStageDrop = { fromStage: string; toStage: string; dropPct: number };

export type DailyReportStats = {
  totalCalls: number;
  connectedCalls: number;
  missedCalls: number;
  contactRatePct: number;
  totalCallSeconds: number;
  avgCallSeconds: number;
  avgCallScore: number | null;
  newLeads: number;
  soldLeads: number;
  soldLeadsPct: number;
  openLeads: number;
  wonLeadsCreated: number;
  wonLeadsCreatedPct: number;
  connectedLeadsCount: number;
  wonFromConnectedCount: number;
  wonFromConnectedPct: number;
  // Only computable when a single funnel is selected -- stage positions
  // aren't comparable across different AmoCRM pipelines. This reads each
  // lead's *current* stage as how far it "reached" in the funnel (there's
  // no per-lead stage-visit history to replay), so it's a snapshot
  // approximation of a true cohort waterfall, not an exact one.
  biggestStageDrop: DailyReportStageDrop | null;
  periodRevenue: number;
  prevPeriodRevenue: number;
  revenueDeltaPct: number | null;
  fullPaymentCount: number;
  prevFullPaymentCount: number;
  fullPaymentDeltaPct: number | null;
  revenueTrend: { label: string; revenue: number }[];
  operatorBreakdown: {
    id: string;
    name: string;
    calls: number;
    avgScore: number | null;
    totalSeconds: number;
  }[];
  callFlowByDay: { label: string; connected: number; missed: number }[];
  // Only computable when a single funnel is selected, same reasoning as
  // biggestStageDrop -- stage names/positions aren't comparable across
  // different AmoCRM pipelines.
  stageBreakdown: { stage: string; count: number; pct: number }[];
};

const EMPTY_DAILY_REPORT_STATS: DailyReportStats = {
  totalCalls: 0,
  connectedCalls: 0,
  missedCalls: 0,
  contactRatePct: 0,
  totalCallSeconds: 0,
  avgCallSeconds: 0,
  avgCallScore: null,
  newLeads: 0,
  soldLeads: 0,
  soldLeadsPct: 0,
  openLeads: 0,
  wonLeadsCreated: 0,
  wonLeadsCreatedPct: 0,
  connectedLeadsCount: 0,
  wonFromConnectedCount: 0,
  wonFromConnectedPct: 0,
  biggestStageDrop: null,
  periodRevenue: 0,
  prevPeriodRevenue: 0,
  revenueDeltaPct: null,
  fullPaymentCount: 0,
  prevFullPaymentCount: 0,
  fullPaymentDeltaPct: null,
  revenueTrend: [],
  operatorBreakdown: [],
  callFlowByDay: [],
  stageBreakdown: [],
};

// A narrower match than SALES_STAGE_KEYWORDS -- "full payment" specifically
// (won or fully-paid), not prepayment/half-payment stages too.
export const FULL_PAYMENT_STAGE_KEYWORDS = ["toliq", "won", "успешно", "rop closed"];

export function useDailyReportStats(
  range: { from: Date; to: Date } | null,
  prevRange: { from: Date; to: Date } | null,
  scope: DailyReportScope,
): DailyReportStats {
  const { data: leads } = useLeadsRaw();
  const { data: calls } = useAmoCrmCallsRaw();
  const { data: stages } = usePipelineStagesRaw();
  const { data: profiles } = useProfilesRaw();

  return useMemo(() => {
    if (!range || !prevRange) return EMPTY_DAILY_REPORT_STATS;

    const stagesById = byId(stages);
    const leadsById = byId(leads);
    const leadFunnelOf = (l: LeadRow) => l.funnel || "Direct Sales";

    let visibleOwnerIds: Set<string> | null = null;
    if (scope.operatorId) {
      visibleOwnerIds = new Set([scope.operatorId]);
    } else if (scope.teamId) {
      const ids = new Set<string>([scope.teamId]);
      for (const p of profiles ?? []) if (p.manager_id === scope.teamId) ids.add(p.id);
      visibleOwnerIds = ids;
    }
    const inScope = (ownerId: string | null): boolean => {
      if (!ownerId) return false;
      return !visibleOwnerIds || visibleOwnerIds.has(ownerId);
    };

    function leadsCreatedIn(r: { from: Date; to: Date }): LeadRow[] {
      return (leads ?? []).filter((l) => {
        if (scope.funnel && leadFunnelOf(l) !== scope.funnel) return false;
        if (!inScope(l.owner_id)) return false;
        const created = new Date(l.created_at);
        return created >= r.from && created < r.to;
      });
    }

    const leadsInRange = leadsCreatedIn(range);

    let soldLeads = 0;
    let wonLeadsCreated = 0;
    let openLeads = 0;
    let periodRevenue = 0;
    let fullPaymentCount = 0;
    const revenueByDay = new Map<string, number>();
    for (const l of leadsInRange) {
      const stage = l.stage_id ? stagesById.get(l.stage_id) : undefined;
      const stageName = stage ? normalizeStageName(stage.name) : "";
      const isSalesStage = SALES_STAGE_KEYWORDS.some((kw) => stageName.includes(kw));
      if (isSalesStage) {
        soldLeads += 1;
        periodRevenue += l.expected_revenue;
        const dayKey = new Date(l.created_at).toDateString();
        revenueByDay.set(dayKey, (revenueByDay.get(dayKey) ?? 0) + l.expected_revenue);
      }
      if (FULL_PAYMENT_STAGE_KEYWORDS.some((kw) => stageName.includes(kw))) fullPaymentCount += 1;
      if (stage?.is_won) wonLeadsCreated += 1;
      if (!stage?.is_won && !stage?.is_lost) openLeads += 1;
    }

    const revenueTrend: DailyReportStats["revenueTrend"] = [];
    for (let d = new Date(range.from); d < range.to; d.setDate(d.getDate() + 1)) {
      revenueTrend.push({
        label: `${d.getDate()}`,
        revenue: revenueByDay.get(d.toDateString()) ?? 0,
      });
    }

    const prevLeadsInRange = leadsCreatedIn(prevRange);
    let prevPeriodRevenue = 0;
    let prevFullPaymentCount = 0;
    for (const l of prevLeadsInRange) {
      const stage = l.stage_id ? stagesById.get(l.stage_id) : undefined;
      const stageName = stage ? normalizeStageName(stage.name) : "";
      if (SALES_STAGE_KEYWORDS.some((kw) => stageName.includes(kw))) {
        prevPeriodRevenue += l.expected_revenue;
      }
      if (FULL_PAYMENT_STAGE_KEYWORDS.some((kw) => stageName.includes(kw))) {
        prevFullPaymentCount += 1;
      }
    }

    const callsInRange = (calls ?? []).filter((c) => {
      const occurred = new Date(c.occurred_at);
      if (occurred < range.from || occurred >= range.to) return false;
      const lead = c.lead_id ? leadsById.get(c.lead_id) : undefined;
      if (scope.funnel && (lead ? leadFunnelOf(lead) : null) !== scope.funnel) return false;
      return inScope(lead?.owner_id ?? null);
    });

    const totalCalls = callsInRange.length;
    const connectedCalls = callsInRange.filter((c) => c.connected).length;
    const totalCallSeconds = callsInRange.reduce((s, c) => s + c.duration_seconds, 0);
    const scoredCalls = callsInRange.filter((c) => c.score != null);
    const avgCallScore = scoredCalls.length
      ? Math.round(scoredCalls.reduce((s, c) => s + (c.score ?? 0), 0) / scoredCalls.length)
      : null;

    const connectedLeadIds = new Set(
      callsInRange.filter((c) => c.connected && c.lead_id).map((c) => c.lead_id!),
    );
    let wonFromConnectedCount = 0;
    for (const id of connectedLeadIds) {
      const lead = leadsById.get(id);
      const stage = lead?.stage_id ? stagesById.get(lead.stage_id) : undefined;
      if (stage?.is_won) wonFromConnectedCount += 1;
    }

    let biggestStageDrop: DailyReportStageDrop | null = null;
    if (scope.funnel) {
      const orderedStages = (stages ?? [])
        .filter((s) => s.pipeline_name === scope.funnel && !s.is_lost)
        .sort((a, b) => a.position - b.position);
      if (orderedStages.length >= 2) {
        const reach = orderedStages.map(
          (s) =>
            leadsInRange.filter((l) => {
              const st = l.stage_id ? stagesById.get(l.stage_id) : undefined;
              return st && !st.is_lost && st.position >= s.position;
            }).length,
        );
        let worstIdx = -1;
        let worstDrop = -Infinity;
        for (let i = 0; i < reach.length - 1; i++) {
          if (reach[i] === 0) continue;
          const drop = 100 - (reach[i + 1]! / reach[i]!) * 100;
          if (drop > worstDrop) {
            worstDrop = drop;
            worstIdx = i;
          }
        }
        if (worstIdx >= 0) {
          biggestStageDrop = {
            fromStage: orderedStages[worstIdx]!.name,
            toStage: orderedStages[worstIdx + 1]!.name,
            dropPct: Math.round(worstDrop),
          };
        }
      }
    }

    const profilesById = byId(profiles);
    type OperatorAgg = { calls: number; scoreSum: number; scoreCount: number; seconds: number };
    const operatorAgg = new Map<string, OperatorAgg>();
    for (const c of callsInRange) {
      const lead = c.lead_id ? leadsById.get(c.lead_id) : undefined;
      if (!lead?.owner_id) continue;
      const cur = operatorAgg.get(lead.owner_id) ?? {
        calls: 0,
        scoreSum: 0,
        scoreCount: 0,
        seconds: 0,
      };
      cur.calls += 1;
      cur.seconds += c.duration_seconds;
      if (c.score != null) {
        cur.scoreSum += c.score;
        cur.scoreCount += 1;
      }
      operatorAgg.set(lead.owner_id, cur);
    }
    const operatorBreakdown = Array.from(operatorAgg.entries())
      .map(([id, a]) => ({
        id,
        name: profileName(profilesById.get(id)),
        calls: a.calls,
        avgScore: a.scoreCount ? Math.round(a.scoreSum / a.scoreCount) : null,
        totalSeconds: a.seconds,
      }))
      .sort((a, b) => b.calls - a.calls);

    const callFlowByDay: DailyReportStats["callFlowByDay"] = [];
    const connectedByDay = new Map<string, number>();
    const missedByDay = new Map<string, number>();
    for (const c of callsInRange) {
      const dayKey = new Date(c.occurred_at).toDateString();
      if (c.connected) connectedByDay.set(dayKey, (connectedByDay.get(dayKey) ?? 0) + 1);
      else missedByDay.set(dayKey, (missedByDay.get(dayKey) ?? 0) + 1);
    }
    for (let d = new Date(range.from); d < range.to; d.setDate(d.getDate() + 1)) {
      const dayKey = d.toDateString();
      callFlowByDay.push({
        label: `${d.getDate()}`,
        connected: connectedByDay.get(dayKey) ?? 0,
        missed: missedByDay.get(dayKey) ?? 0,
      });
    }

    let stageBreakdown: DailyReportStats["stageBreakdown"] = [];
    if (scope.funnel) {
      const funnelStages = (stages ?? [])
        .filter((s) => s.pipeline_name === scope.funnel)
        .sort((a, b) => a.position - b.position);
      const base = leadsInRange.length || 1;
      stageBreakdown = funnelStages
        .map((s) => {
          const count = leadsInRange.filter((l) => l.stage_id === s.id).length;
          return { stage: s.name, count, pct: Math.round((count / base) * 1000) / 10 };
        })
        .filter((s) => s.count > 0);
    }

    return {
      totalCalls,
      connectedCalls,
      missedCalls: totalCalls - connectedCalls,
      contactRatePct: totalCalls ? Math.round((connectedCalls / totalCalls) * 1000) / 10 : 0,
      totalCallSeconds,
      avgCallSeconds: totalCalls ? Math.round(totalCallSeconds / totalCalls) : 0,
      avgCallScore,
      newLeads: leadsInRange.length,
      soldLeads,
      soldLeadsPct: leadsInRange.length
        ? Math.round((soldLeads / leadsInRange.length) * 1000) / 10
        : 0,
      openLeads,
      wonLeadsCreated,
      wonLeadsCreatedPct: leadsInRange.length
        ? Math.round((wonLeadsCreated / leadsInRange.length) * 1000) / 10
        : 0,
      connectedLeadsCount: connectedLeadIds.size,
      wonFromConnectedCount,
      wonFromConnectedPct: connectedLeadIds.size
        ? Math.round((wonFromConnectedCount / connectedLeadIds.size) * 1000) / 10
        : 0,
      biggestStageDrop,
      periodRevenue,
      prevPeriodRevenue,
      revenueDeltaPct:
        prevPeriodRevenue > 0
          ? Math.round(((periodRevenue - prevPeriodRevenue) / prevPeriodRevenue) * 1000) / 10
          : null,
      fullPaymentCount,
      prevFullPaymentCount,
      fullPaymentDeltaPct:
        prevFullPaymentCount > 0
          ? Math.round(((fullPaymentCount - prevFullPaymentCount) / prevFullPaymentCount) * 1000) /
            10
          : null,
      revenueTrend,
      operatorBreakdown,
      callFlowByDay,
      stageBreakdown,
    };
  }, [
    leads,
    calls,
    stages,
    profiles,
    range,
    prevRange,
    scope.funnel,
    scope.teamId,
    scope.operatorId,
  ]);
}

// Both dashboard funnel widgets used to aggregate the deals table (which
// this AmoCRM-synced setup never actually populates -- real revenue lives
// on leads) and/or every pipeline_stages row across the whole org (~60
// AmoCRM pipelines here, all sharing generic stage names like
// "Неразобранное") with no funnel filter, producing a chart with dozens of
// duplicate-labeled all-zero bars. Both now require an explicit funnel
// selection and read real, funnel-scoped lead data -- the funnel-scoped
// fetch is shared (same react-query key) between the two widgets, so
// selecting a funnel costs one request, not two.
export function usePipelineStageStats(funnel: string | null) {
  const board = usePipelineBoardLeads(funnel);
  return useMemo(() => {
    if (!funnel) return [];
    const funnelStages = board.stages
      .filter((s) => s.pipeline_name === funnel)
      .sort((a, b) => a.position - b.position);
    return funnelStages.map((s) => {
      const inStage = board.rows.filter((l) => l.stageId === s.id);
      return {
        stage: s.name,
        value: inStage.reduce((sum, l) => sum + l.expectedRevenue, 0),
        deals: inStage.length,
      };
    });
  }, [funnel, board.stages, board.rows]);
}

export function useFunnelFlow(funnel: string | null) {
  const board = usePipelineBoardLeads(funnel);
  return useMemo(() => {
    if (!funnel) return [];
    const funnelStages = board.stages
      .filter((s) => s.pipeline_name === funnel)
      .sort((a, b) => a.position - b.position);
    const base = board.rows.length || 1;
    return funnelStages.map((s) => {
      const count = board.rows.filter((l) => l.stageId === s.id).length;
      return { stage: s.name, count, conversion: Math.round((count / base) * 1000) / 10 };
    });
  }, [funnel, board.stages, board.rows]);
}

export type DashboardKpi = {
  id: string;
  label: string;
  value: string;
  comparison: string;
  tooltip: string;
};

// Assumed baseline win rate used to project pipeline revenue when nothing
// unusual is known about a lead — matches the "normal conversion" the user
// asked this KPI to reason in terms of, rather than a raw sum of deal value.
const NORMAL_CONVERSION_RATE = 0.15;

export type DashboardFilters = {
  from: string | null;
  to: string | null;
  funnel: string | null;
  minAmount?: number | null;
  maxAmount?: number | null;
};

type DashboardKpiValues = {
  revenueToday: number;
  revenueMonth: number;
  pipelineValue: number;
  openDealsCount: number;
  newLeadsToday: number;
  wonThisWeek: number;
  lostThisWeek: number;
  conversion: number;
};

const EMPTY_DASHBOARD_KPIS: DashboardKpiValues = {
  revenueToday: 0,
  revenueMonth: 0,
  pipelineValue: 0,
  openDealsCount: 0,
  newLeadsToday: 0,
  wonThisWeek: 0,
  lostThisWeek: 0,
  conversion: 0,
};

// Live path (the default -- no overrides passed) used to pull the whole
// org's leads + deals + stages client-side just to reduce them into these
// eight numbers. dashboard_kpis computes the same numbers in Postgres.
// The as-of-date override path still reduces client-side below, since that
// snapshot only exists in memory (reconstructed from the audit trail) and
// is small by nature -- there's nothing in the database to query it from.
function useDashboardKpisLive(
  filters: DashboardFilters | undefined,
  enabled: boolean,
): DashboardKpiValues {
  const { user } = useAuth();
  const from = filters?.from ?? null;
  const to = filters?.to ?? null;
  const funnel = filters?.funnel ?? null;
  const minAmount = filters?.minAmount ?? null;
  const maxAmount = filters?.maxAmount ?? null;

  const query = useQuery({
    queryKey: ["dashboard_kpis", user?.organizationId, from, to, funnel, minAmount, maxAmount],
    enabled: enabled && !!user?.organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("dashboard_kpis", {
          p_from: from,
          p_to: to,
          p_funnel: funnel,
          p_min_amount: minAmount,
          p_max_amount: maxAmount,
        })
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const d = query.data;
  if (!d) return EMPTY_DASHBOARD_KPIS;
  return {
    revenueToday: Number(d.revenue_today ?? 0),
    revenueMonth: Number(d.revenue_month ?? 0),
    pipelineValue: Number(d.pipeline_value ?? 0),
    openDealsCount: Number(d.open_deals_count ?? 0),
    newLeadsToday: Number(d.new_leads_today ?? 0),
    wonThisWeek: Number(d.won_this_week ?? 0),
    lostThisWeek: Number(d.lost_this_week ?? 0),
    conversion: Number(d.conversion ?? 0),
  };
}

function useDashboardKpisFromOverride(
  filters: DashboardFilters | undefined,
  overrides: { leads?: LeadRow[] | undefined; deals?: DealRow[] | undefined },
): DashboardKpiValues {
  const { data: stages } = usePipelineStagesRaw();
  const visibleOwnerIds = useVisibleOwnerIds();
  const deals = useMemo(() => {
    const rows = overrides.deals ?? [];
    return visibleOwnerIds
      ? rows.filter((d) => !!d.owner_id && visibleOwnerIds.has(d.owner_id))
      : rows;
  }, [overrides.deals, visibleOwnerIds]);
  const leads = useMemo(() => {
    const rows = overrides.leads ?? [];
    return visibleOwnerIds
      ? rows.filter((l) => !!l.owner_id && visibleOwnerIds.has(l.owner_id))
      : rows;
  }, [overrides.leads, visibleOwnerIds]);

  return useMemo(() => {
    const from = filters?.from ?? null;
    const to = filters?.to ?? null;
    const funnel = filters?.funnel ?? null;
    const minAmount = filters?.minAmount ?? null;
    const maxAmount = filters?.maxAmount ?? null;

    // The funnel filter narrows every card to that funnel's data; the date
    // range narrows which leads count toward lead-driven metrics (new
    // leads, pipeline projection, conversion). Revenue/won/lost cards keep
    // their own literal today/week/month windows regardless of the date
    // filter — "today's revenue" always means today, not an arbitrary range.
    const leadRows = (leads ?? []).filter((l) => {
      if (from && l.created_at < from) return false;
      if (to && l.created_at > to) return false;
      if (funnel && (l.funnel || "Direct Sales") !== funnel) return false;
      if (minAmount != null && l.expected_revenue < minAmount) return false;
      if (maxAmount != null && l.expected_revenue > maxAmount) return false;
      return true;
    });
    const leadsById = byId(leads);
    const dealRows = (deals ?? []).filter((d) => {
      if (funnel) {
        const lead = d.lead_id ? leadsById.get(d.lead_id) : undefined;
        if ((lead?.funnel || "Direct Sales") !== funnel) return false;
      }
      if (minAmount != null && Number(d.value) < minAmount) return false;
      if (maxAmount != null && Number(d.value) > maxAmount) return false;
      return true;
    });
    const stagesById = byId(stages);
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

    // Pipeline value = expected revenue if the leads currently sitting in
    // the pipeline close at a normal 15% conversion rate, i.e.
    // openLeads * 0.15 * average revenue per real sale — not a raw sum of
    // every open lead's optimistic expected_revenue.
    const openLeads = leadRows.filter((l) => {
      const stage = l.stage_id ? stagesById.get(l.stage_id) : undefined;
      return !stage?.is_won && !stage?.is_lost;
    });
    const wonLeads = leadRows.filter((l) => {
      const stage = l.stage_id ? stagesById.get(l.stage_id) : undefined;
      return stage?.is_won;
    });
    const avgDealValue = wonLeads.length
      ? wonLeads.reduce((s, l) => s + l.expected_revenue, 0) / wonLeads.length
      : openLeads.length
        ? openLeads.reduce((s, l) => s + l.expected_revenue, 0) / openLeads.length
        : 0;
    const pipelineValue = Math.round(openLeads.length * NORMAL_CONVERSION_RATE * avgDealValue);

    return {
      revenueToday,
      revenueMonth,
      pipelineValue,
      openDealsCount: openLeads.length,
      newLeadsToday: newLeadsToday.length,
      wonThisWeek: wonThisWeek.length,
      lostThisWeek: lostThisWeek.length,
      conversion,
    };
  }, [
    deals,
    leads,
    stages,
    filters?.from,
    filters?.to,
    filters?.funnel,
    filters?.minAmount,
    filters?.maxAmount,
  ]);
}

export function useDashboardKpis(
  filters?: DashboardFilters,
  overrides?: { leads?: LeadRow[] | undefined; deals?: DealRow[] | undefined },
): DashboardKpiValues {
  const useOverride = !!(overrides?.leads || overrides?.deals);
  // Both branches are hooks, so both always run (React's rules of hooks) --
  // only the relevant one's result is used, same pattern as useCrmLeads'
  // as-of-date handling.
  const live = useDashboardKpisLive(filters, !useOverride);
  const overridden = useDashboardKpisFromOverride(filters, {
    leads: useOverride ? overrides?.leads : [],
    deals: useOverride ? overrides?.deals : [],
  });
  return useOverride ? overridden : live;
}

export type ActivityItem = {
  id: string;
  who: string;
  what: string;
  when: string;
  leadName: string | null;
};

export function useRecentActivity(limit = 6, funnel?: string | null) {
  const { user } = useAuth();
  const { data: leads } = useLeadsRaw();
  const { data: profiles } = useProfilesRaw();
  const visibleOwnerIds = useVisibleOwnerIds();

  // A funnel filter (or an owner-scoped role) has to narrow the lead set
  // *before* the row limit is applied, not after — otherwise "8 most recent
  // org-wide" gets client-filtered down to whatever's left, which can be
  // empty even when plenty of matching activity exists further back. This
  // also closes a real gap: this query previously had no owner scoping at
  // all, so a rep could see a teammate's activity here.
  const needsScoping = !!funnel || !!visibleOwnerIds;
  const scopedLeadIds = useMemo(() => {
    if (!needsScoping) return null;
    return (leads ?? [])
      .filter((l) => {
        if (funnel && (l.funnel || "Direct Sales") !== funnel) return false;
        if (visibleOwnerIds && (!l.owner_id || !visibleOwnerIds.has(l.owner_id))) return false;
        return true;
      })
      .map((l) => l.id);
  }, [leads, funnel, visibleOwnerIds, needsScoping]);
  const scopeKey = scopedLeadIds ? scopedLeadIds.slice().sort().join(",") : null;

  const activityQuery = useQuery({
    queryKey: ["recent-activity", limit, funnel ?? null, scopeKey],
    enabled: !!user && (!needsScoping || leads !== undefined),
    queryFn: async (): Promise<LeadActivityRow[]> => {
      if (scopedLeadIds && scopedLeadIds.length === 0) return [];
      let query = supabase.from("lead_activities").select("*");
      if (scopedLeadIds) query = query.in("lead_id", scopedLeadIds);
      const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });

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

// Used to read the (essentially unused, since this is an AmoCRM-synced
// setup where real revenue lives on leads) deals table -- always 0. Reuses
// the same leaderboard_stats RPC the Reyting page itself uses, so this
// widget's numbers actually match the full leaderboard.
export function useTopPerformers(limit = 5) {
  const { user } = useAuth();
  const { data: profiles } = useProfilesRaw();
  const statsQuery = useQuery({
    queryKey: ["leaderboard_stats", null, null, null, null, ""],
    enabled: !!user?.organizationId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("leaderboard_stats", {
        p_from: null,
        p_to: null,
        p_funnel: null,
        p_stage_id: null,
        p_tags: null,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  return useMemo(() => {
    const statsByOwner = new Map((statsQuery.data ?? []).map((r) => [r.owner_id, r]));
    const people = profiles ?? [];
    return people
      .map((p) => {
        const stats = statsByOwner.get(p.id);
        return {
          id: p.id,
          name: p.full_name || p.email,
          department: p.department,
          deals: stats?.won_leads ?? 0,
          revenue: stats?.revenue ?? 0,
          // null (not a fake "1") when no real target is set — dividing
          // revenue by a placeholder target of 1 produced nonsensical
          // percentages in the millions (e.g. "7,399,960%") for anyone
          // without a monthly_target configured.
          target: p.monthly_target || null,
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }, [statsQuery.data, profiles, limit]);
}

/* ------------------------------------------------------------------ */
/* AmoCRM integration — status readout + manual sync trigger.          */
/* ------------------------------------------------------------------ */

export type IntegrationSettingRow = Database["public"]["Tables"]["integration_settings"]["Row"];

export function useIntegrationSetting(key: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["integration_settings", key, user?.organizationId],
    enabled: !!user?.organizationId,
    queryFn: async (): Promise<IntegrationSettingRow | null> => {
      const { data, error } = await supabase
        .from("integration_settings")
        .select("*")
        .eq("organization_id", user!.organizationId!)
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Builds a deep link to a lead's record in the connected AmoCRM account, or null if not connected/synced. */
export function useAmoCrmLink() {
  const { data: setting } = useIntegrationSetting("amocrm");
  const subdomain = (setting?.config as { subdomain?: string } | null)?.subdomain;
  return (amocrmId: number | null): string | null => {
    if (!subdomain || !amocrmId) return null;
    return `https://${subdomain}/leads/detail/${amocrmId}`;
  };
}

export type AmoConnectionStatus = {
  subdomain: string;
  connected_at: string;
  last_synced_at: string | null;
  last_sync_error: string | null;
};

/** The connected org's own AmoCRM sync status/error — super_admin only (RLS). Polls every 3s so the Integrations page reflects a sync as it happens, without a manual refresh. */
export function useAmoConnectionStatus() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["amocrm_connection_status", user?.organizationId],
    enabled:
      !!user?.organizationId && (user.role === "super_admin" || user.role === "platform_owner"),
    refetchInterval: 3000,
    queryFn: async (): Promise<AmoConnectionStatus | null> => {
      const { data, error } = await supabase
        .from("amocrm_connection")
        .select("subdomain, connected_at, last_synced_at, last_sync_error")
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
      const text = await res.text();
      let json: { synced: number; error?: string };
      try {
        json = JSON.parse(text);
      } catch {
        // Platform-level failure (timeout, crash) returned a non-JSON body
        // — surface the raw text rather than letting JSON.parse's own
        // error ("Unexpected token ... is not valid JSON") stand in for it.
        throw new Error(text || `Sync failed (${res.status})`);
      }
      if (!res.ok) throw new Error(json.error ?? "Sync failed");
      return json;
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["leads"] });
      void qc.invalidateQueries({ queryKey: ["amocrm_calls"] });
      void qc.invalidateQueries({ queryKey: ["integration_settings", "amocrm"] });
      void qc.invalidateQueries({ queryKey: ["amocrm_connection_status"] });
    },
  });
}

export function useDisconnectAmoCrm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/admin/amocrm-disconnect", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not disconnect.");
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["integration_settings", "amocrm"] });
      void qc.invalidateQueries({ queryKey: ["amocrm_connection_status"] });
      void qc.invalidateQueries({ queryKey: ["amocrm_catalog"] });
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

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/admin/delete-employee", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to delete employee");
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["profiles"] });
    },
  });
}

export function useSetEmployeePassword() {
  return useMutation({
    mutationFn: async (input: { id: string; password: string }): Promise<void> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/admin/set-employee-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to set password");
    },
  });
}

export type OrganizationRow = Tables["organizations"]["Row"];

export function useOrganizations() {
  return useQuery({
    queryKey: ["organizations"],
    queryFn: async (): Promise<OrganizationRow[]> => {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      admin_email: string;
      admin_password: string;
      admin_full_name: string;
      rop_email: string;
      rop_password: string;
      rop_full_name: string;
      phone?: string | undefined;
      plan?: string | undefined;
      trial_days?: number | undefined;
    }): Promise<{ organizationId: string }> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/platform/create-organization", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create organization");
      return json;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["organizations"] }),
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Pick<OrganizationRow, "name" | "phone" | "plan" | "active" | "trial_ends_at">>;
    }) => {
      const { error } = await supabase.from("organizations").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["organizations"] }),
  });
}

export function useDeactivateExpiredTrials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      await fetch("/platform/deactivate-expired-trials", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["organizations"] }),
  });
}

/** Platform owner: delete any company member's account, from any organization. */
export function useDeleteUserAsOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/platform/delete-user", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to delete user");
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["owner_all_profiles"] }),
  });
}

/** Platform owner: edit any company member's name, role, and/or reset their password. */
export function useUpdateUserAsOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      full_name?: string;
      role?: "super_admin" | "rop" | "sotuv_menejeri";
      password?: string;
    }): Promise<void> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/platform/update-user", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to update user");
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["owner_all_profiles"] }),
  });
}

/** Platform owner: add a ROP/Sotuv menejeri/Super Admin account to an existing company. */
export function useAddOrgEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      organization_id: string;
      email: string;
      password: string;
      full_name: string;
      role: "super_admin" | "rop" | "sotuv_menejeri";
    }): Promise<{ id: string }> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/platform/add-employee", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to add employee");
      return json;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["owner_all_profiles"] }),
  });
}

/** Platform owner: permanently delete a company and every row/account tied to it. */
export function useDeleteOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/platform/delete-organization", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to delete company");
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["organizations"] });
      void qc.invalidateQueries({ queryKey: ["owner_all_profiles"] });
    },
  });
}

// Cross-org visibility for the platform owner only — RLS on each of these
// tables grants read access to is_platform_owner() (see migration
// 20260812130000_owner_panel.sql); every other role's queries stay scoped
// to their own organization_id as before.

export type OwnerProfileRow = ProfileRow & { organizations: { name: string } | null };

export function useAllProfiles() {
  return useQuery({
    queryKey: ["owner_all_profiles"],
    queryFn: async (): Promise<OwnerProfileRow[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, organizations(name)")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as OwnerProfileRow[];
    },
  });
}

export type OwnerAmoConnectionRow = {
  organization_id: string;
  subdomain: string;
  connected_at: string;
  last_synced_at: string | null;
  last_sync_error: string | null;
  organizations: { name: string } | null;
};

export function useAllAmoConnections() {
  return useQuery({
    queryKey: ["owner_all_amo_connections"],
    queryFn: async (): Promise<OwnerAmoConnectionRow[]> => {
      // Deliberately not selecting access_token/refresh_token — the owner
      // overview only needs connection status, never the live OAuth secrets.
      const { data, error } = await supabase
        .from("amocrm_connection")
        .select(
          "organization_id, subdomain, connected_at, last_synced_at, last_sync_error, organizations(name)",
        );
      if (error) throw error;
      return (data ?? []) as OwnerAmoConnectionRow[];
    },
  });
}

export type OwnerAiAgentRow = Tables["ai_agents"]["Row"] & {
  organizations: { name: string } | null;
};

export function useAllAiAgents() {
  return useQuery({
    queryKey: ["owner_all_ai_agents"],
    queryFn: async (): Promise<OwnerAiAgentRow[]> => {
      const { data, error } = await supabase
        .from("ai_agents")
        .select("*, organizations(name)")
        .order("organization_id", { ascending: true });
      if (error) throw error;
      return (data ?? []) as OwnerAiAgentRow[];
    },
  });
}

export type OwnerAuditLogRow = Tables["audit_logs"]["Row"] & {
  organizations: { name: string } | null;
};

export function useAllAuditLogs() {
  return useQuery({
    queryKey: ["owner_all_audit_logs"],
    queryFn: async (): Promise<OwnerAuditLogRow[]> => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*, organizations(name)")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as OwnerAuditLogRow[];
    },
  });
}

export function useAiAssistantChat() {
  return useMutation({
    mutationFn: async (input: {
      messages: { role: "user" | "assistant"; content: string }[];
      asOf?: Date | null;
    }): Promise<string> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/ai-assistant/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: input.messages,
          asOf: input.asOf ? input.asOf.toISOString() : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "AI assistant failed");
      return json.reply as string;
    },
  });
}

/* ------------------------------------------------------------------ */
/* AI Assistant chat history -- conversations used to live only in the  */
/* browser tab's React state (gone on refresh), so there was no "Tarix" */
/* (history) to show, search, or resume. Persisted the same way the     */
/* rest of the app's owner-scoped tables work.                          */
/* ------------------------------------------------------------------ */

export type AiChatConversationRow = Database["public"]["Tables"]["ai_chat_conversations"]["Row"];
export type AiChatMessageRow = Database["public"]["Tables"]["ai_chat_messages"]["Row"];

export function useAiConversations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["ai_chat_conversations", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<AiChatConversationRow[]> => {
      const { data, error } = await supabase
        .from("ai_chat_conversations")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAiConversationMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ["ai_chat_messages", conversationId],
    enabled: !!conversationId,
    queryFn: async (): Promise<AiChatMessageRow[]> => {
      const { data, error } = await supabase
        .from("ai_chat_messages")
        .select("*")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateAiConversation() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (title: string): Promise<AiChatConversationRow> => {
      if (!user?.id) throw new Error("Not signed in.");
      const { data, error } = await supabase
        .from("ai_chat_conversations")
        .insert({ profile_id: user.id, title: title.slice(0, 80) || "New chat" })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ai_chat_conversations"] });
    },
  });
}

export function useSaveAiMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      conversationId: string;
      role: "user" | "assistant";
      content: string;
    }) => {
      const { error: insertError } = await supabase.from("ai_chat_messages").insert({
        conversation_id: input.conversationId,
        role: input.role,
        content: input.content,
      });
      if (insertError) throw insertError;
      // Bumps updated_at so this conversation sorts back to the top of the
      // history panel the moment it gets a new message.
      const { error: touchError } = await supabase
        .from("ai_chat_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", input.conversationId);
      if (touchError) throw touchError;
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["ai_chat_conversations"] });
      void qc.invalidateQueries({ queryKey: ["ai_chat_messages", vars.conversationId] });
    },
  });
}

export function useAnalyzeCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      callId: string,
    ): Promise<{
      transcript: string;
      summary: string;
      nextStep: string | null;
      taskWarning: string | null;
      score: number | null;
      mood: string | null;
      talkRatio: number | null;
      analysis: CallAnalysis | null;
    }> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/audio-analytics/analyze", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ callId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Call analysis failed");
      return json;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["amocrm_calls"] }),
  });
}

export type ManualCallUpload = {
  file: File;
  leadId: string | null;
  phone: string;
  direction: "in" | "out";
  connected: boolean;
};

export function useUploadManualCall() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ManualCallUpload) => {
      if (!user) throw new Error("Not signed in");
      const ext = input.file.name.split(".").pop() || "mp3";
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("call-recordings")
        .upload(path, input.file, { contentType: input.file.type || "audio/mpeg" });
      if (uploadError) throw new Error(uploadError.message);

      const { data: pub } = supabase.storage.from("call-recordings").getPublicUrl(path);

      const row: Tables["amocrm_calls"]["Insert"] = {
        source: "manual",
        organization_id: user.organizationId!,
        created_by: user.id,
        amocrm_note_id: null,
        lead_id: input.leadId,
        direction: input.direction,
        phone: input.phone || null,
        connected: input.connected,
        recording_url: pub.publicUrl,
        occurred_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("amocrm_calls").insert(row);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["amocrm_calls"] }),
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

/* ------------------------------------------------------------------ */
/* Notification preferences — per-user opt-in for in-app notifications.*/
/* Readable by anyone (so the person creating a task can check whether */
/* the assignee wants to be notified); writable only by the owner.     */
/* ------------------------------------------------------------------ */

export type NotificationPreferencesRow = Tables["notification_preferences"]["Row"];

export function useNotificationPreferences() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notification_preferences", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<NotificationPreferencesRow> => {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("profile_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (
        data ?? { profile_id: user!.id, task_assigned: true, updated_at: new Date().toISOString() }
      );
    },
  });
}

export function useUpdateNotificationPreferences() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (patch: { task_assigned: boolean }) => {
      const { error } = await supabase
        .from("notification_preferences")
        .upsert({ profile_id: user!.id, ...patch }, { onConflict: "profile_id" });
      if (error) throw error;
    },
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["notification_preferences", user?.id] }),
  });
}

// Called after a task is created with a real assignee — checks the
// assignee's preference (defaulting to on) before writing the notification,
// so the toggle in Settings actually controls something.
export async function notifyTaskAssigned(assigneeId: string, taskTitle: string): Promise<void> {
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("task_assigned")
    .eq("profile_id", assigneeId)
    .maybeSingle();
  if (prefs && prefs.task_assigned === false) return;
  await supabase.from("notifications").insert({
    user_id: assigneeId,
    type: "task_assigned",
    title: taskTitle,
    body: "Sizga yangi vazifa biriktirildi.",
    link: "/tasks",
  });

  // The in-app bell above is done at this point (client insert, RLS-backed,
  // same as always) -- this is purely the extra push send, which needs the
  // VAPID private key and can only run server-side. Best-effort: if the
  // assignee has no push subscription (or push isn't configured at all),
  // the server route just reports 0 sent, nothing to handle here.
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;
    await fetch("/notifications/send-push", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        assigneeId,
        title: taskTitle,
        body: "Sizga yangi vazifa biriktirildi.",
        link: "/tasks",
      }),
    });
  } catch {
    // Push is a nice-to-have on top of the in-app bell -- never let a
    // network hiccup here surface as a failure to the task-creation flow.
  }
}

/* ------------------------------------------------------------------ */
/* Business profile — a single shared row used as AI assistant context */
/* ------------------------------------------------------------------ */

export type BusinessProfileRow = Tables["business_profile"]["Row"];

export type ProductServiceItem = { name: string; description: string };
export type ObjectionItem = { objection: string; response: string };
export type GlossaryItem = { term: string; definition: string };

export function useBusinessProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["business_profile", user?.organizationId],
    enabled: !!user?.organizationId,
    queryFn: async (): Promise<BusinessProfileRow | null> => {
      const { data, error } = await supabase
        .from("business_profile")
        .select("*")
        .eq("organization_id", user!.organizationId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateBusinessProfile() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (
      patch: Partial<
        Pick<
          BusinessProfileRow,
          | "company_name"
          | "description"
          | "competitors"
          | "terminology"
          | "tone"
          | "value_proposition"
          | "target_customer"
          | "qualified_lead_definition"
          | "products_services"
          | "objections"
          | "glossary"
          | "competitors_list"
        >
      >,
    ) => {
      const { data, error } = await supabase
        .from("business_profile")
        .upsert(
          { organization_id: user!.organizationId!, ...patch, updated_by: user?.id ?? null },
          { onConflict: "organization_id" },
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["business_profile", user?.organizationId] }),
  });
}

/* ------------------------------------------------------------------ */
/* Security Center — per-org password policy + 2FA-required flag.      */
/* ------------------------------------------------------------------ */

export type SecuritySettingsRow = Tables["security_settings"]["Row"];

const DEFAULT_SECURITY_SETTINGS: Omit<SecuritySettingsRow, "organization_id"> = {
  min_password_length: 8,
  require_number: false,
  require_uppercase: false,
  require_symbol: false,
  two_factor_required: false,
  updated_at: "",
  updated_by: null,
};

/** Falls back to the platform default policy when the org hasn't saved custom settings yet. */
export function useSecuritySettings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["security_settings", user?.organizationId],
    enabled: !!user?.organizationId,
    queryFn: async (): Promise<SecuritySettingsRow> => {
      const { data, error } = await supabase
        .from("security_settings")
        .select("*")
        .eq("organization_id", user!.organizationId!)
        .maybeSingle();
      if (error) throw error;
      return data ?? { organization_id: user!.organizationId!, ...DEFAULT_SECURITY_SETTINGS };
    },
  });
}

export function useUpdateSecuritySettings() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (
      patch: Partial<
        Pick<
          SecuritySettingsRow,
          | "min_password_length"
          | "require_number"
          | "require_uppercase"
          | "require_symbol"
          | "two_factor_required"
        >
      >,
    ) => {
      const { data, error } = await supabase
        .from("security_settings")
        .upsert(
          { organization_id: user!.organizationId!, ...patch, updated_by: user?.id ?? null },
          { onConflict: "organization_id" },
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["security_settings", user?.organizationId] }),
  });
}

export type SecurityUserStatus = {
  id: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
};

/** Login activity + block status for the org's employees — lives on auth.users, so it's fetched via a service-role route rather than a direct table read. */
export function useSecurityUsers() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["security_users", user?.organizationId],
    enabled:
      !!user?.organizationId && (user.role === "super_admin" || user.role === "platform_owner"),
    queryFn: async (): Promise<SecurityUserStatus[]> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/admin/security-users", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = (await res.json()) as { users?: SecurityUserStatus[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not load login activity.");
      return json.users ?? [];
    },
  });
}

export function useToggleUserBan() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ userId, ban }: { userId: string; ban: boolean }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/admin/security-ban", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId, ban }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not update the account.");
      return json;
    },
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["security_users", user?.organizationId] }),
  });
}

/* ------------------------------------------------------------------ */
/* AmoCRM import settings — pick which pipelines/operators to sync.    */
/* ------------------------------------------------------------------ */

export type AmoCatalogPipeline = { id: number; name: string; is_main: boolean };
export type AmoCatalogOperator = {
  id: number;
  name: string;
  email: string | null;
  existingProfileEmail: string | null;
};
export type AmoCatalog = {
  subdomain: string;
  pipelines: AmoCatalogPipeline[];
  operators: AmoCatalogOperator[];
  enabledPipelineIds: number[] | null;
  enabledUserIds: number[] | null;
};

export function useAmoCatalog() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["amocrm_catalog", user?.organizationId],
    enabled:
      !!user?.organizationId && (user.role === "super_admin" || user.role === "platform_owner"),
    queryFn: async (): Promise<AmoCatalog> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/admin/amocrm-catalog", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = (await res.json()) as AmoCatalog & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not load AmoCRM catalog.");
      return json;
    },
  });
}

export function useSaveAmoImportSettings() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ pipelineIds, userIds }: { pipelineIds: number[]; userIds: number[] }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/admin/amocrm-import-settings", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ pipelineIds, userIds }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not save.");
      return json;
    },
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["amocrm_catalog", user?.organizationId] }),
  });
}

/* ------------------------------------------------------------------ */
/* Tags — aggregated across every lead, with rename/delete that touch  */
/* every lead carrying that tag.                                       */
/* ------------------------------------------------------------------ */

export type TagSummary = { name: string; count: number };

export function useTagsSummary(funnel?: string | null) {
  const { data: leads, ...rest } = useLeadsRaw();
  const tags = useMemo<TagSummary[]>(() => {
    const counts = new Map<string, number>();
    for (const l of leads ?? []) {
      if (funnel && (l.funnel || "Direct Sales") !== funnel) continue;
      for (const tag of l.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [leads, funnel]);
  return { tags, ...rest };
}

export function useRenameTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ from, to }: { from: string; to: string }) => {
      const { data: leads, error: fetchErr } = await supabase
        .from("leads")
        .select("id, tags")
        .contains("tags", [from]);
      if (fetchErr) throw fetchErr;
      for (const lead of leads ?? []) {
        const next = Array.from(new Set((lead.tags ?? []).map((t) => (t === from ? to : t))));
        const { error } = await supabase.from("leads").update({ tags: next }).eq("id", lead.id);
        if (error) throw error;
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tag: string) => {
      const { data: leads, error: fetchErr } = await supabase
        .from("leads")
        .select("id, tags")
        .contains("tags", [tag]);
      if (fetchErr) throw fetchErr;
      for (const lead of leads ?? []) {
        const next = (lead.tags ?? []).filter((t) => t !== tag);
        const { error } = await supabase.from("leads").update({ tags: next }).eq("id", lead.id);
        if (error) throw error;
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

/* ------------------------------------------------------------------ */
/* Attendance — manual clock-in/out and call logging, aggregated into  */
/* a per-employee daily roster. A future telephony integration can     */
/* insert into call_logs the same way and this keeps working as-is.    */
/* ------------------------------------------------------------------ */

export type WorkSessionRow = Tables["work_sessions"]["Row"];
export type CallLogRow = Tables["call_logs"]["Row"];

function isSameDay(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

function isToday(iso: string): boolean {
  return isSameDay(iso, new Date());
}

export function useMyOpenSession() {
  const { user } = useAuth();
  const { data: sessions, ...rest } = useWorkSessionsRaw({ enabled: !!user });
  const open = (sessions ?? []).find(
    (s) => s.profile_id === user?.id && !s.clock_out && isToday(s.clock_in),
  );
  return { session: open ?? null, ...rest };
}

export function useClockIn() {
  const create = useCreateWorkSession();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      return create.mutateAsync({ profile_id: user.id });
    },
  });
}

export function useClockOut() {
  const update = useUpdateWorkSession();
  return useMutation({
    mutationFn: async (sessionId: string) =>
      update.mutateAsync({ id: sessionId, patch: { clock_out: new Date().toISOString() } }),
  });
}

export function useLogCall() {
  const create = useCreateCallLog();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      leadId?: string | null;
      contactId?: string | null;
      phone?: string;
      connected: boolean;
      durationSeconds: number;
    }) => {
      if (!user) throw new Error("Not signed in");
      return create.mutateAsync({
        profile_id: user.id,
        lead_id: input.leadId ?? null,
        contact_id: input.contactId ?? null,
        phone: input.phone ?? null,
        connected: input.connected,
        duration_seconds: input.durationSeconds,
      });
    },
  });
}

export type AttendanceRow = {
  profileId: string;
  managerId: string | null;
  name: string;
  initials: string;
  position: string;
  clockIn: string | null;
  clockOut: string | null;
  sessionMinutes: number;
  callsMade: number;
  callsConnected: number;
  totalCallMinutes: number;
};

export function useAttendanceView(
  asOf?: Date | null,
  overrides?: { sessions?: WorkSessionRow[] | undefined; calls?: CallLogRow[] | undefined },
) {
  const profiles = useProfilesRaw();
  const liveSessions = useWorkSessionsRaw();
  const liveCalls = useCallLogsRaw();
  const sessions = overrides?.sessions ?? liveSessions.data;
  const calls = overrides?.calls ?? liveCalls.data;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- asOf?.getTime() is the stable key
  const refDate = useMemo(() => asOf ?? new Date(), [asOf?.getTime()]);

  const rows = useMemo<AttendanceRow[]>(() => {
    return (profiles.data ?? []).map((p): AttendanceRow => {
      const mySessions = (sessions ?? []).filter(
        (s) => s.profile_id === p.id && isSameDay(s.clock_in, refDate),
      );
      const latest = mySessions[0] ?? null;
      const sessionMinutes = mySessions.reduce((sum, s) => {
        const end = s.clock_out ? new Date(s.clock_out).getTime() : Date.now();
        return sum + Math.max(0, (end - new Date(s.clock_in).getTime()) / 60000);
      }, 0);
      const myCalls = (calls ?? []).filter(
        (c) => c.profile_id === p.id && isSameDay(c.created_at, refDate),
      );
      return {
        profileId: p.id,
        managerId: p.manager_id,
        name: profileName(p),
        initials: initialsOf(p.full_name || p.email),
        position: p.position,
        clockIn: latest?.clock_in ?? null,
        clockOut: latest?.clock_out ?? null,
        sessionMinutes: Math.round(sessionMinutes),
        callsMade: myCalls.length,
        callsConnected: myCalls.filter((c) => c.connected).length,
        totalCallMinutes: Math.round(myCalls.reduce((s, c) => s + c.duration_seconds, 0) / 60),
      };
    });
  }, [profiles.data, sessions, calls, refDate]);

  return {
    rows,
    isLoading: profiles.isLoading || liveSessions.isLoading || liveCalls.isLoading,
  };
}

/* ------------------------------------------------------------------ */
/* Normativlar (quotas) — real revenue vs. each employee's daily/       */
/* monthly target from profiles + deals, no new tables needed.          */
/* ------------------------------------------------------------------ */

export type NormativeStatus = "onTrack" | "atRisk" | "behind";

export type NormativeRow = {
  profileId: string;
  name: string;
  initials: string;
  department: string;
  dailyTarget: number;
  monthlyTarget: number;
  revenueToday: number;
  revenueMonth: number;
  monthlyPct: number;
  pacePct: number;
  status: NormativeStatus;
};

export function useNormativesView() {
  const { user } = useAuth();
  const { data: profiles, isLoading: profilesLoading } = useProfilesRaw();
  // Revenue used to come from the `deals` table — but this AmoCRM-synced
  // setup never populates deals (leads carry the real revenue), so every
  // rep's revenueToday/revenueMonth here was silently always 0. Compute it
  // from won leads instead, same as Dashboard/Reyting already do. Leads
  // have no close_date of their own, so updated_at is used as a proxy for
  // "when it closed" — the same snapshot-proxy approach used elsewhere in
  // this schema (there's no per-lead stage-change history to read instead).
  const { data: leads, isLoading: leadsLoading } = useLeadsRaw();
  const { data: stages, isLoading: stagesLoading } = usePipelineStagesRaw();

  const rows = useMemo<NormativeRow[]>(() => {
    const stagesById = byId(stages);
    const wonLeads = (leads ?? []).filter((l) => {
      const stage = l.stage_id ? stagesById.get(l.stage_id) : undefined;
      return stage?.is_won ?? false;
    });
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);
    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const expectedPaceFraction = dayOfMonth / daysInMonth;

    // Super admins see the whole company. A ROP sees their own reports; a
    // sotuv_menejeri sees every teammate under the same ROP (including
    // themselves) so they can see who's ahead/behind, per spec — not the
    // full company.
    const roster = (profiles ?? []).filter((p) => {
      if (p.role === "super_admin" || p.role === "platform_owner") return false;
      if (!user || user.role === "super_admin" || user.role === "platform_owner") return true;
      if (user.role === "rop") return p.manager_id === user.id;
      return p.manager_id === user.managerId;
    });

    return roster.map((p): NormativeRow => {
      const won = wonLeads.filter((l) => l.owner_id === p.id);
      const revenueToday = won
        .filter((l) => new Date(l.updated_at) >= startOfToday)
        .reduce((s, l) => s + Number(l.expected_revenue), 0);
      const revenueMonth = won
        .filter((l) => new Date(l.updated_at) >= startOfMonth)
        .reduce((s, l) => s + Number(l.expected_revenue), 0);
      const monthlyTarget = p.monthly_target;
      const monthlyPct =
        monthlyTarget > 0 ? Math.round((revenueMonth / monthlyTarget) * 1000) / 10 : 0;
      const expectedByNow = monthlyTarget * expectedPaceFraction;
      const pacePct =
        expectedByNow > 0 ? Math.round((revenueMonth / expectedByNow) * 1000) / 10 : 0;
      const status: NormativeStatus =
        pacePct >= 90 ? "onTrack" : pacePct >= 60 ? "atRisk" : "behind";
      return {
        profileId: p.id,
        name: profileName(p),
        initials: initialsOf(p.full_name || p.email),
        department: p.department,
        dailyTarget: p.daily_target,
        monthlyTarget: p.monthly_target,
        revenueToday,
        revenueMonth,
        monthlyPct,
        pacePct,
        status,
      };
    });
  }, [profiles, leads, stages, user]);

  return { rows, isLoading: profilesLoading || leadsLoading || stagesLoading };
}

/* ------------------------------------------------------------------ */
/* Telegram "hisobotchi_bot" — link-code flow + daily report send.     */
/* ------------------------------------------------------------------ */

async function authedFetch(path: string, init?: RequestInit) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  return fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
}

export function useLinkTelegram() {
  const { refreshProfile } = useAuth();
  return useMutation({
    mutationFn: async (): Promise<{ code: string; botUsername: string | null }> => {
      const res = await authedFetch("/telegram/link", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to generate a link code");
      return json;
    },
    onSuccess: () => void refreshProfile(),
  });
}

export function useSendTestReport() {
  return useMutation({
    mutationFn: async () => {
      const res = await authedFetch("/telegram/send-test", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to send");
      return json;
    },
  });
}

export function useSetTelegramBotUsername() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (username: string) => {
      const { error } = await supabase.from("integration_settings").upsert(
        {
          organization_id: user!.organizationId!,
          key: "telegram_bot",
          config: { username },
          enabled: true,
        },
        { onConflict: "organization_id,key" },
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["integration_settings", "telegram_bot"] }),
  });
}

/* ------------------------------------------------------------------ */
/* Office location — a single precise address (OpenStreetMap search/    */
/* embed, no maps API key needed) shown in the header, admin-editable.  */
/* ------------------------------------------------------------------ */

export type OfficeLocationConfig = { label: string; address: string; lat: number; lon: number };

export function useSetOfficeLocation() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (config: OfficeLocationConfig) => {
      const { error } = await supabase
        .from("integration_settings")
        .upsert(
          { organization_id: user!.organizationId!, key: "office_location", config, enabled: true },
          { onConflict: "organization_id,key" },
        );
      if (error) throw new Error(error.message);
    },
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["integration_settings", "office_location"] }),
  });
}

/* ------------------------------------------------------------------ */
/* Error logs — everything caught by the global client-side handlers   */
/* and server routes, surfaced in Admin Panel so issues get fixed fast.*/
/* ------------------------------------------------------------------ */

export type ErrorLogRow = Tables["error_logs"]["Row"];
const errorLogsResource = makeResource("error_logs", ["error_logs"]);

export const useErrorLogsRaw = (opts?: Parameters<typeof errorLogsResource.useList>[0]) =>
  errorLogsResource.useList({ orderBy: "created_at", ascending: false, ...opts });
export const useResolveErrorLog = errorLogsResource.useUpdate;

/* ------------------------------------------------------------------ */
/* Auto-responders — admin-configured "ask this, save the answer to    */
/* this CRM field" scripts. Config only: actually sending needs a      */
/* connected messaging channel, which isn't wired up yet.              */
/* ------------------------------------------------------------------ */

export type AutoResponderRow = Tables["auto_responders"]["Row"];
const autoRespondersResource = makeResource("auto_responders", ["auto_responders"]);

export const useAutoRespondersRaw = (opts?: Parameters<typeof autoRespondersResource.useList>[0]) =>
  autoRespondersResource.useList({ orderBy: "created_at", ascending: false, ...opts });
export const useCreateAutoResponder = autoRespondersResource.useCreate;
export const useUpdateAutoResponder = autoRespondersResource.useUpdate;
export const useDeleteAutoResponder = autoRespondersResource.useRemove;

/* ------------------------------------------------------------------ */
/* AI Agents — two fixed presets (chat / call analysis). Config only:  */
/* actually running one needs a live model API key wired up server-    */
/* side, which this workspace does not have yet — the UI says so.      */
/* ------------------------------------------------------------------ */

export type AiAgentRow = Tables["ai_agents"]["Row"];

export function useAiAgents() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["ai_agents", user?.organizationId],
    enabled: !!user?.organizationId,
    queryFn: async (): Promise<AiAgentRow[]> => {
      const { data, error } = await supabase
        .from("ai_agents")
        .select("*")
        .eq("organization_id", user!.organizationId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpdateAiAgent() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (patch: {
      kind: "chat" | "call";
      model?: string | undefined;
      system_prompt?: string | undefined;
      channels?: string[] | undefined;
      active?: boolean | undefined;
    }) => {
      const row: Tables["ai_agents"]["Insert"] = {
        kind: patch.kind,
        organization_id: user!.organizationId!,
        updated_by: user?.id ?? null,
      };
      if (patch.model !== undefined) row.model = patch.model;
      if (patch.system_prompt !== undefined) row.system_prompt = patch.system_prompt;
      if (patch.channels !== undefined) row.channels = patch.channels;
      if (patch.active !== undefined) row.active = patch.active;
      const { error } = await supabase
        .from("ai_agents")
        .upsert(row, { onConflict: "organization_id,kind" });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["ai_agents", user?.organizationId] }),
  });
}

/* ------------------------------------------------------------------ */
/* Which funnel (pipeline) names are enabled for import — every funnel  */
/* filter in the app (sidebar, Dashboard, Reyting, Funnels, AmoCRM      */
/* board) consults this so a pipeline unchecked in "Import qilinadigan  */
/* voronkalar" never appears as a filter option. null = no restriction. */
/* ------------------------------------------------------------------ */

export function useEnabledFunnelNames(): Set<string> | null {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["enabled_funnel_names", user?.organizationId],
    enabled: !!user?.organizationId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string[] | null> => {
      const { data, error } = await supabase.rpc("enabled_funnel_names");
      if (error) throw error;
      return data ?? null;
    },
  });
  return useMemo(() => (data ? new Set(data) : null), [data]);
}

/* ------------------------------------------------------------------ */
/* Distinct funnel names — for the sidebar's expandable Funnels group. */
/* ------------------------------------------------------------------ */

export function useFunnelNames() {
  const { data: leads, isLoading } = useLeadsRaw();
  const visibleOwnerIds = useVisibleOwnerIds();
  const enabledFunnels = useEnabledFunnelNames();
  const names = useMemo(() => {
    const set = new Set<string>();
    for (const l of leads ?? []) {
      if (visibleOwnerIds && !(l.owner_id && visibleOwnerIds.has(l.owner_id))) continue;
      const name = l.funnel || "Direct Sales";
      if (enabledFunnels && !enabledFunnels.has(name)) continue;
      set.add(name);
    }
    return Array.from(set).sort();
  }, [leads, visibleOwnerIds, enabledFunnels]);
  return { names, isLoading };
}

/* ------------------------------------------------------------------ */
/* Funnel-level stat cards (Reyting) — computed directly from the raw   */
/* leads table rather than summed across per-manager leaderboard rows,  */
/* so a lead with no (or an unmatched) owner still counts toward the    */
/* funnel's totals instead of silently vanishing from the sum.          */
/* ------------------------------------------------------------------ */

// AmoCRM stage names are whatever the org typed into their own pipeline, and
// vary funnel to funnel -- confirmed real-world variants (per the user):
//   Prepayment:   "Predoplata", "Predoplata qildi", "Predoplata qildi |
//                 kelishuv bor", and the observed misspelling "Peredoplata"
//   Half payment: always "Yarim to'lov"
//   Full payment: "To'liq to'lov qildi", "WON | To'liq to'lov",
//                 "Успешно реализовано" (ru), or bare "WON"
//   Exception:    some funnels use "ROP Closed" in place of a full-payment
//                 stage -- counts as a sale too when it shows up
// Matched loosely (lowercased, apostrophes stripped) against any of these
// as a substring, not an exact string.
export const SALES_STAGE_KEYWORDS = [
  "predoplata",
  "peredoplata",
  "yarim",
  "toliq",
  "won",
  "успешно",
  "rop closed",
];

export function normalizeStageName(name: string): string {
  return name.toLowerCase().replace(/['’ʼ`]/g, "");
}

export type FunnelStats = {
  totalLeads: number;
  totalRevenue: number;
  wonCount: number;
  wonRevenue: number;
  lostCount: number;
  salesStageCount: number;
  salesStageRevenue: number;
  // Average deal size across sales-stage leads only (salesStageRevenue /
  // salesStageCount) -- the "o'rtacha chek" the Dashboard's projection cards
  // are built from.
  avgCheck: number;
  conversion: number;
  isLoading: boolean;
};

export function useFunnelStats(
  funnel?: string | null,
  opts?: { overrideLeads?: LeadRow[] | undefined },
): FunnelStats {
  const useOverride = !!opts?.overrideLeads;
  const { data: liveLeads, isLoading: liveLeadsLoading } = useLeadsRaw();
  const { data: stages, isLoading: stagesLoading } = usePipelineStagesRaw();
  const leads = useOverride ? opts?.overrideLeads : liveLeads;
  const leadsLoading = useOverride ? false : liveLeadsLoading;

  return useMemo(() => {
    const stagesById = byId(stages);
    let totalLeads = 0;
    let totalRevenue = 0;
    let wonCount = 0;
    let wonRevenue = 0;
    let lostCount = 0;
    let salesStageCount = 0;
    let salesStageRevenue = 0;

    for (const l of leads ?? []) {
      const leadFunnel = l.funnel || "Direct Sales";
      if (funnel && leadFunnel !== funnel) continue;
      totalLeads += 1;
      totalRevenue += l.expected_revenue;
      const stage = l.stage_id ? stagesById.get(l.stage_id) : undefined;
      if (stage?.is_won) {
        wonCount += 1;
        wonRevenue += l.expected_revenue;
      }
      if (stage?.is_lost) lostCount += 1;
      const stageName = stage ? normalizeStageName(stage.name) : "";
      if (SALES_STAGE_KEYWORDS.some((kw) => stageName.includes(kw))) {
        salesStageCount += 1;
        salesStageRevenue += l.expected_revenue;
      }
    }

    return {
      totalLeads,
      totalRevenue,
      wonCount,
      wonRevenue,
      lostCount,
      salesStageCount,
      salesStageRevenue,
      avgCheck: salesStageCount ? salesStageRevenue / salesStageCount : 0,
      // Sales-stage count (prepayment/half-payment/full-payment), not WON --
      // this is "Umumiy konversiya" as specified, distinct from the WON-only
      // ratio a plain won/total conversion would give.
      conversion: totalLeads ? (salesStageCount / totalLeads) * 100 : 0,
      isLoading: leadsLoading || stagesLoading,
    };
  }, [leads, stages, funnel, leadsLoading, stagesLoading]);
}

/* ------------------------------------------------------------------ */
/* Today's per-funnel call activity (Dashboard "Kunlik calltime" card)  */
/* — how many managers made at least one call today in this funnel, how */
/* much total/average talk time, and how many distinct leads each       */
/* manager reached on average.                                          */
/* ------------------------------------------------------------------ */

export type FunnelCallStats = {
  managerCount: number;
  totalSeconds: number;
  avgSecondsPerManager: number;
  avgContactsPerManager: number;
  isLoading: boolean;
};

export function useFunnelCallStats(funnel?: string | null): FunnelCallStats {
  const { data: calls, isLoading: callsLoading } = useAmoCrmCallsRaw();
  const { data: leads, isLoading: leadsLoading } = useLeadsRaw();

  return useMemo(() => {
    const leadsById = byId(leads);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Every call's duration/contact counts toward the card's totals as long
    // as it resolves to a lead (regardless of whether that lead has an
    // owner_id) -- a call shouldn't vanish from "today's activity" just
    // because its lead's AmoCRM responsible user didn't map to a SalesOS
    // profile. managerCount/per-manager averages still need a real owner_id
    // to attribute to someone, so those are tracked separately.
    const byManager = new Map<string, { seconds: number; leadIds: Set<string> }>();
    let totalSeconds = 0;
    const allContacts = new Set<string>();
    for (const c of calls ?? []) {
      if (new Date(c.occurred_at) < startOfToday) continue;
      if (!c.lead_id) continue;
      const lead = leadsById.get(c.lead_id);
      const leadFunnel = lead?.funnel || "Direct Sales";
      if (funnel && leadFunnel !== funnel) continue;

      totalSeconds += c.duration_seconds;
      allContacts.add(c.lead_id);

      if (!lead?.owner_id) continue;
      const cur = byManager.get(lead.owner_id) ?? { seconds: 0, leadIds: new Set<string>() };
      cur.seconds += c.duration_seconds;
      cur.leadIds.add(lead.id);
      byManager.set(lead.owner_id, cur);
    }

    const managerCount = byManager.size;

    return {
      managerCount,
      totalSeconds,
      avgSecondsPerManager: managerCount ? Math.round(totalSeconds / managerCount) : 0,
      avgContactsPerManager: managerCount
        ? Math.round((allContacts.size / managerCount) * 10) / 10
        : 0,
      isLoading: callsLoading || leadsLoading,
    };
  }, [calls, leads, funnel, callsLoading, leadsLoading]);
}

/* ------------------------------------------------------------------ */
/* Open AmoCRM task counts (Dashboard "zadachalar" card) — live-fetched, */
/* not stored locally, since this app never syncs AmoCRM's own task list */
/* in (it only ever pushes single reminder tasks out to AmoCRM).         */
/* ------------------------------------------------------------------ */

export type AmoTaskCardStats = { dueToday: number; overdue: number };

export function useAmoCrmTaskStats(funnel?: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["amocrm_task_stats", user?.organizationId, funnel ?? null],
    enabled: !!user?.organizationId,
    refetchInterval: 60_000,
    queryFn: async (): Promise<AmoTaskCardStats> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const params = new URLSearchParams();
      if (funnel) params.set("funnel", funnel);
      const res = await fetch(`/dashboard/amocrm-tasks?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = (await res.json()) as AmoTaskCardStats & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not load AmoCRM tasks.");
      return { dueToday: json.dueToday, overdue: json.overdue };
    },
  });
}

/* ------------------------------------------------------------------ */
/* Lead Analytics — "Harakat kerak" tab. Computed entirely in SQL (see    */
/* lead_analytics_action RPC) since this runs over the org's full lead    */
/* table, not the small filtered slices useLeadsRaw()'s callers work with. */
/* ------------------------------------------------------------------ */

export type LeadAnalyticsRecoverableRow = {
  lead_id: string;
  name: string;
  manager: string;
  days_since_closed: number;
  next_follow_up: string | null;
};

export type LeadAnalyticsHotRow = {
  lead_id: string;
  name: string;
  manager: string;
  score: number;
  temperature: string;
  stage: string;
  value: number;
};

export type LeadAnalyticsOperatorRow = {
  manager: string;
  won_connected: number;
  won_attempts: number;
  lost_connected: number;
  lost_attempts: number;
};

export type LeadAnalyticsActionData = {
  totalLeads: number;
  avgConversion: number;
  hotLeads: number;
  churnRisk: number;
  recoverable: LeadAnalyticsRecoverableRow[];
  hotPipeline: LeadAnalyticsHotRow[];
  operatorActivity: LeadAnalyticsOperatorRow[];
};

export function useLeadAnalyticsAction(
  funnel: string | null,
  manager: string | null,
  since: Date | null,
  team: string | null,
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [
      "lead_analytics_action",
      user?.organizationId,
      funnel,
      manager,
      since?.getTime(),
      team,
    ],
    enabled: !!user?.organizationId,
    queryFn: async (): Promise<LeadAnalyticsActionData> => {
      const { data, error } = await supabase.rpc("lead_analytics_action", {
        p_funnel: funnel,
        p_manager: manager,
        p_since: since ? since.toISOString() : null,
        p_team: team,
      });
      if (error) throw error;
      return data as unknown as LeadAnalyticsActionData;
    },
  });
}

// Manager dropdown on Lead Analytics needs to cascade with the funnel
// filter too (not just the team/ROP filter it already had) -- this page
// has no client-side lead list to derive that from (everything else on
// it goes through SQL RPCs), so it's a small dedicated query instead.
export function useManagerIdsInFunnel(funnel: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["manager_ids_in_funnel", user?.organizationId, funnel],
    enabled: !!user?.organizationId && !!funnel,
    queryFn: async (): Promise<Set<string>> => {
      if (!funnel) return new Set();
      const { data, error } = await supabase
        .from("leads")
        .select("owner_id")
        .eq("funnel", funnel)
        .not("owner_id", "is", null);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.owner_id as string));
    },
  });
}

/* ------------------------------------------------------------------ */
/* Lead Analytics — "Lead sifati" tab. Per-tag aggregation, also SQL-side */
/* (unnest(leads.tags)) for the same scale reason as the action tab.      */
/* ------------------------------------------------------------------ */

export type LeadAnalyticsTagResultRow = {
  tag: string;
  sold: number;
  lost: number;
  open: number;
  total: number;
};

export type LeadAnalyticsTagMatrixRow = {
  tag: string;
  total: number;
  avg_score: number | null;
  conversion: number | null;
  low_sample: boolean;
};

export type LeadAnalyticsTagCategoryRow = {
  tag: string;
  cold: number;
  warm: number;
  hot: number;
  very_hot: number;
};

export type LeadAnalyticsQualityData = {
  tagResults: LeadAnalyticsTagResultRow[];
  tagMatrix: LeadAnalyticsTagMatrixRow[];
  tagCategories: LeadAnalyticsTagCategoryRow[];
};

export function useLeadAnalyticsQuality(
  funnel: string | null,
  manager: string | null,
  team: string | null,
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["lead_analytics_quality", user?.organizationId, funnel, manager, team],
    enabled: !!user?.organizationId,
    queryFn: async (): Promise<LeadAnalyticsQualityData> => {
      const { data, error } = await supabase.rpc("lead_analytics_quality", {
        p_funnel: funnel,
        p_manager: manager,
        p_team: team,
      });
      if (error) throw error;
      return data as unknown as LeadAnalyticsQualityData;
    },
  });
}

/* ------------------------------------------------------------------ */
/* Lead Analytics — "Hozirgi holat" tab. Same SQL-side-aggregation reasoning */
/* as the other two lead_analytics_* hooks.                                 */
/* ------------------------------------------------------------------ */

export type LeadAnalyticsStageRow = {
  stage: string;
  lead_count: number;
  avg_days: number | null;
};

export type LeadAnalyticsManagerLoadRow = {
  manager: string;
  cold: number;
  warm: number;
  hot: number;
  very_hot: number;
  total: number;
};

export type LeadAnalyticsCurrentData = {
  temperature: { cold: number; warm: number; hot: number; veryHot: number };
  stages: LeadAnalyticsStageRow[];
  managerLoad: LeadAnalyticsManagerLoadRow[];
};

export function useLeadAnalyticsCurrent(
  funnel: string | null,
  manager: string | null,
  team: string | null,
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["lead_analytics_current", user?.organizationId, funnel, manager, team],
    enabled: !!user?.organizationId,
    queryFn: async (): Promise<LeadAnalyticsCurrentData> => {
      const { data, error } = await supabase.rpc("lead_analytics_current", {
        p_funnel: funnel,
        p_manager: manager,
        p_team: team,
      });
      if (error) throw error;
      return data as unknown as LeadAnalyticsCurrentData;
    },
  });
}

/* ------------------------------------------------------------------ */
/* Lead Analytics — "Yo'nalish" tab. Same SQL-side-aggregation reasoning as */
/* the other three lead_analytics_* hooks.                                  */
/* ------------------------------------------------------------------ */

export type LeadAnalyticsLostReasonRow = { reason: string; count: number };

export type LeadAnalyticsChurnRow = {
  lead_id: string;
  name: string;
  manager: string;
  days_since_contact: number | null;
  risk_percent: number;
  score: number;
  temperature: string;
};

export type LeadAnalyticsDirectionData = {
  direction: { closingSoon: number; neutral: number; losingSoon: number };
  lostReasons: LeadAnalyticsLostReasonRow[];
  churnRisk: LeadAnalyticsChurnRow[];
};

export function useLeadAnalyticsDirection(
  funnel: string | null,
  manager: string | null,
  team: string | null,
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["lead_analytics_direction", user?.organizationId, funnel, manager, team],
    enabled: !!user?.organizationId,
    queryFn: async (): Promise<LeadAnalyticsDirectionData> => {
      const { data, error } = await supabase.rpc("lead_analytics_direction", {
        p_funnel: funnel,
        p_manager: manager,
        p_team: team,
      });
      if (error) throw error;
      return data as unknown as LeadAnalyticsDirectionData;
    },
  });
}

/* ------------------------------------------------------------------ */
/* Per-manager funnel stats (Reyting live-ranking table) — same raw-lead */
/* computation as useFunnelStats above, grouped by owner instead of      */
/* summed across the whole funnel.                                       */
/* ------------------------------------------------------------------ */

export type ManagerFunnelStats = { totalLeads: number; salesCount: number; salesRevenue: number };

export function useManagerFunnelStats(
  funnel?: string | null,
  opts?: { overrideLeads?: LeadRow[] | undefined },
): Map<string, ManagerFunnelStats> {
  const { data: liveLeads } = useLeadsRaw();
  const { data: stages } = usePipelineStagesRaw();
  const leads = opts?.overrideLeads ?? liveLeads;
  return useMemo(() => {
    const stagesById = byId(stages);
    const map = new Map<string, ManagerFunnelStats>();
    for (const l of leads ?? []) {
      if (!l.owner_id) continue;
      const leadFunnel = l.funnel || "Direct Sales";
      if (funnel && leadFunnel !== funnel) continue;
      const cur = map.get(l.owner_id) ?? { totalLeads: 0, salesCount: 0, salesRevenue: 0 };
      cur.totalLeads += 1;
      const stage = l.stage_id ? stagesById.get(l.stage_id) : undefined;
      const stageName = stage ? normalizeStageName(stage.name) : "";
      if (SALES_STAGE_KEYWORDS.some((kw) => stageName.includes(kw))) {
        cur.salesCount += 1;
        cur.salesRevenue += l.expected_revenue;
      }
      map.set(l.owner_id, cur);
    }
    return map;
  }, [leads, stages, funnel]);
}

/* ------------------------------------------------------------------ */
/* Daily per-manager trend (Reyting charts) — conversion% and sales-     */
/* stage revenue, bucketed by day of lead creation, for every manager    */
/* with at least one lead in the funnel. "Conversion" here is each       */
/* day's cohort of created leads that are *currently* sitting in a       */
/* sales stage — there's no stored historical snapshot of conversion     */
/* itself to chart directly, so this is the closest real approximation.  */
/* ------------------------------------------------------------------ */

const DEFAULT_TREND_DAYS = 30;
// A "Butun davr" (all-time) range with years of history would otherwise
// bucket into hundreds of illegible daily points -- cap it the same way
// the chart itself is already capped for legibility.
const MAX_TREND_DAYS = 90;

export type ManagerTrendSeries = {
  id: string;
  name: string;
  conversion: (number | null)[];
  salesRevenue: number[];
};

export type ManagerDailyTrend = { dayLabels: string[]; series: ManagerTrendSeries[] };

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function useManagerDailyTrend(
  funnel?: string | null,
  from?: Date | null,
  to?: Date | null,
): ManagerDailyTrend {
  const { data: leads } = useLeadsRaw();
  const { data: stages } = usePipelineStagesRaw();
  const { data: profiles } = useProfilesRaw();
  const managerStats = useManagerFunnelStats(funnel);

  return useMemo(() => {
    const rangeEnd = startOfDay(to ?? new Date());
    const rangeStart = from
      ? startOfDay(from)
      : new Date(rangeEnd.getTime() - (DEFAULT_TREND_DAYS - 1) * 86400000);
    const dayCount = Math.min(
      MAX_TREND_DAYS,
      Math.max(1, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86400000) + 1),
    );

    const dayStarts: Date[] = [];
    for (let i = dayCount - 1; i >= 0; i--) {
      const d = new Date(rangeEnd);
      d.setDate(d.getDate() - i);
      dayStarts.push(d);
    }
    const dayLabels = dayStarts.map((d) => `${d.getDate()}.${d.getMonth() + 1}`);

    const ownerIds = Array.from(managerStats.entries())
      .sort((a, b) => b[1].salesRevenue - a[1].salesRevenue)
      .map(([id]) => id);
    if (ownerIds.length === 0) return { dayLabels, series: [] };

    const profilesById = byId(profiles);
    const stagesById = byId(stages);

    type Bucket = { total: number; sales: number; salesRevenue: number };
    const buckets = new Map<string, Bucket[]>();
    for (const id of ownerIds) {
      buckets.set(
        id,
        dayStarts.map(() => ({ total: 0, sales: 0, salesRevenue: 0 })),
      );
    }

    for (const l of leads ?? []) {
      if (!l.owner_id || !buckets.has(l.owner_id)) continue;
      const leadFunnel = l.funnel || "Direct Sales";
      if (funnel && leadFunnel !== funnel) continue;
      const created = new Date(l.created_at);
      let dayIndex = -1;
      for (let i = dayStarts.length - 1; i >= 0; i--) {
        if (created >= dayStarts[i]!) {
          dayIndex = i;
          break;
        }
      }
      if (dayIndex === -1) continue;
      const bucket = buckets.get(l.owner_id)![dayIndex]!;
      bucket.total += 1;
      const stage = l.stage_id ? stagesById.get(l.stage_id) : undefined;
      const stageName = stage ? normalizeStageName(stage.name) : "";
      if (SALES_STAGE_KEYWORDS.some((kw) => stageName.includes(kw))) {
        bucket.sales += 1;
        bucket.salesRevenue += l.expected_revenue;
      }
    }

    const series: ManagerTrendSeries[] = ownerIds.map((id) => {
      const b = buckets.get(id)!;
      return {
        id,
        name: profileName(profilesById.get(id)),
        conversion: b.map((w) => (w.total ? (w.sales / w.total) * 100 : null)),
        salesRevenue: b.map((w) => w.salesRevenue),
      };
    });

    return { dayLabels, series };
  }, [leads, stages, profiles, managerStats, funnel, from, to]);
}

/* ------------------------------------------------------------------ */
/* Audit / history — full change trail with time-travel, fed by the     */
/* audit_row_change() triggers on leads/deals/tasks/companies/contacts/ */
/* pipeline_stages/profiles. Each row stores the complete before/after  */
/* row snapshot, so "state as of time X" is just the latest audit row   */
/* at-or-before X — no diff replay needed.                              */
/* ------------------------------------------------------------------ */

export type AuditLogRow = Tables["audit_logs"]["Row"];
export const AUDIT_ENTITY_TYPES = [
  "leads",
  "deals",
  "tasks",
  "companies",
  "contacts",
  "pipeline_stages",
  "profiles",
  "amocrm_calls",
  "work_sessions",
  "call_logs",
] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export type AuditEntryView = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorId: string | null;
  actorName: string;
  when: string;
  createdAt: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  changedFields: string[];
};

const AUDIT_IGNORE_FIELDS = new Set(["updated_at", "created_at"]);

function diffFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): string[] {
  if (!before || !after) return [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  for (const k of keys) {
    if (AUDIT_IGNORE_FIELDS.has(k)) continue;
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) changed.push(k);
  }
  return changed;
}

function toAuditView(row: AuditLogRow, actorName: string): AuditEntryView {
  const meta = (row.meta ?? {}) as {
    old?: Record<string, unknown>;
    new?: Record<string, unknown>;
  };
  return {
    id: row.id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    actorId: row.actor_id,
    actorName,
    when: timeAgo(row.created_at),
    createdAt: row.created_at,
    before: meta.old ?? null,
    after: meta.new ?? null,
    changedFields: diffFields(meta.old ?? null, meta.new ?? null),
  };
}

/** Full change history for one specific record (used on the lead detail page etc). */
export function useAuditTrail(entityType: AuditEntityType, entityId: string | undefined) {
  const { data: profiles } = useProfilesRaw();
  const query = useQuery({
    queryKey: ["audit_logs", entityType, entityId],
    enabled: !!entityId,
    queryFn: async (): Promise<AuditLogRow[]> => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = useMemo<AuditEntryView[]>(() => {
    const profilesById = byId(profiles);
    return (query.data ?? []).map((r) =>
      toAuditView(r, r.actor_id ? profileName(profilesById.get(r.actor_id)) : "System"),
    );
  }, [query.data, profiles]);
  return { rows, isLoading: query.isLoading };
}

/** Org-wide activity feed across every tracked table — the History page. */
export function useOrgActivityFeed(limit = 200) {
  const { user } = useAuth();
  const { data: profiles } = useProfilesRaw();
  const query = useQuery({
    queryKey: ["audit_logs_feed", user?.organizationId, limit],
    enabled: !!user?.organizationId,
    queryFn: async (): Promise<AuditLogRow[]> => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("organization_id", user!.organizationId!)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = useMemo<AuditEntryView[]>(() => {
    const profilesById = byId(profiles);
    return (query.data ?? []).map((r) =>
      toAuditView(r, r.actor_id ? profileName(profilesById.get(r.actor_id)) : "System"),
    );
  }, [query.data, profiles]);
  return { rows, isLoading: query.isLoading, isError: query.isError };
}

// "As of date": reconstructs an entire table's rows exactly as they stood
// at a past moment, via the entities_as_of() SQL function — the latest
// audit_logs snapshot at-or-before that timestamp for every entity_id,
// excluding ones whose latest state by then was a delete. Pages pass the
// result as an override to their normal live-data hook (e.g. useCrmLeads)
// so the rest of the page's joins/rendering logic stays identical.
export function useAsOfSnapshot<T>(entityType: AuditEntityType, asOf: Date | null) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["entities_as_of", entityType, user?.organizationId, asOf?.toISOString() ?? null],
    enabled: !!user?.organizationId && !!asOf,
    queryFn: async (): Promise<T[]> => {
      const { data, error } = await supabase.rpc("entities_as_of", {
        p_organization_id: user!.organizationId!,
        p_entity_type: entityType,
        p_as_of: asOf!.toISOString(),
      });
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
  return { data: query.data, isLoading: query.isLoading, isError: query.isError };
}

// "Time travel": reconstructs a record's full state as of a past moment —
// the latest audit_logs snapshot at or before that timestamp, since every
// insert/update stores the complete row rather than just a diff.
export function useRecordStateAt() {
  return useMutation({
    mutationFn: async (input: {
      entityType: AuditEntityType;
      entityId: string;
      at: string;
    }): Promise<Record<string, unknown> | null> => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("action, meta")
        .eq("entity_type", input.entityType)
        .eq("entity_id", input.entityId)
        .lte("created_at", input.at)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const meta = (data.meta ?? {}) as {
        old?: Record<string, unknown>;
        new?: Record<string, unknown>;
      };
      return data.action === "delete" ? (meta.old ?? null) : (meta.new ?? null);
    },
  });
}
