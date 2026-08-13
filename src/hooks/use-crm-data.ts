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

export const useRolePermissions = (opts?: Parameters<typeof rolePermissionsResource.useList>[0]) =>
  rolePermissionsResource.useList(opts);
export const useUpdateRolePermission = rolePermissionsResource.useUpdate;

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

export function useCrmBase() {
  const companies = useCompaniesRaw();
  const contacts = useContactsRaw();
  const leads = useLeadsRaw();
  const deals = useDealsRaw();
  const stages = usePipelineStagesRaw();
  const profiles = useProfilesRaw();
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
  updated: string;
  tags: string[];
  amocrmId: number | null;
};

// overrideLeads lets callers substitute a reconstructed "as of a past date"
// snapshot (see useAsOfSnapshot) in place of the live leads table, while
// still joining against the current contacts/profiles/stages for display
// names — the same shape either way.
export function useCrmLeads(overrideLeads?: LeadRow[]) {
  const base = useCrmBase();
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

    return sourceLeads.map((l): CrmLeadView => {
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
        stageIsWon: stage?.is_won ?? false,
        stageIsLost: stage?.is_lost ?? false,
        funnel: l.funnel ?? "",
        nextFollowUp: formatFollowUp(l.next_follow_up),
        lastContact: timeAgo(l.last_contact_at),
        created: formatDate(l.created_at),
        updated: timeAgo(l.updated_at),
        tags: l.tags ?? [],
        amocrmId: l.amocrm_id,
      };
    });
  }, [sourceLeads, base.contacts, base.profiles, base.stages]);

  return { rows, ...base };
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

export function useLeaderboardView(
  filters: LeaderboardFilters,
  opts?: { refetchInterval?: number | false; overrideLeads?: LeadRow[] | undefined },
) {
  const refetchInterval = opts?.refetchInterval ?? false;
  const {
    data: liveLeads,
    isLoading: leadsLoading,
    isFetching: leadsFetching,
    refetch: refetchLeads,
    dataUpdatedAt,
  } = useLeadsRaw({ refetchInterval });
  const leads = opts?.overrideLeads ?? liveLeads;
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
  const isLoading = leadsLoading || profilesLoading || stagesLoading;
  const isFetching = leadsFetching || profilesFetching || stagesFetching;

  const refetch = () => Promise.all([refetchLeads(), refetchProfiles(), refetchStages()]);

  const stagesById = useMemo(() => byId(stages), [stages]);

  const filteredLeads = useMemo(
    () =>
      (leads ?? []).filter((l) => {
        if (filters.from && l.created_at < filters.from) return false;
        if (filters.to && l.created_at > filters.to) return false;
        if (filters.stageId && l.stage_id !== filters.stageId) return false;
        if (filters.funnel && (l.funnel || "Direct Sales") !== filters.funnel) return false;
        if (filters.tags.length > 0 && !filters.tags.some((tag) => (l.tags ?? []).includes(tag)))
          return false;
        return true;
      }),
    [leads, filters.from, filters.to, filters.stageId, filters.funnel, filters.tags],
  );

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
        const mine = filteredLeads.filter((l) => l.owner_id === p.id);
        const won = mine.filter((l) => (l.stage_id ? stagesById.get(l.stage_id)?.is_won : false));
        const lost = mine.filter((l) => (l.stage_id ? stagesById.get(l.stage_id)?.is_lost : false));
        const revenue = won.reduce((s, l) => s + l.expected_revenue, 0);
        const conversion = mine.length ? (won.length / mine.length) * 100 : 0;
        const targetCompletion = p.monthly_target > 0 ? (revenue / p.monthly_target) * 100 : 0;
        return {
          id: p.id,
          name: profileName(p),
          initials: initialsOf(profileName(p)),
          avatarUrl: p.avatar_url,
          totalLeads: mine.length,
          wonLeads: won.length,
          lostLeads: lost.length,
          revenue,
          conversion,
          kpiPercent: p.kpi_percent,
          monthlyTarget: p.monthly_target,
          targetCompletion,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [profiles, filteredLeads, stagesById, filters.search]);

  return {
    rows,
    filteredLeads,
    stages: stages ?? [],
    isLoading,
    isFetching,
    refetch,
    dataUpdatedAt,
  };
}

/* ------------------------------------------------------------------ */
/* View: Audio Analytics (real AmoCRM call activity). Transcript + AI       */
/* summary are populated on demand via useAnalyzeCall(), which needs both  */
/* OPENAI_API_KEY (transcription) and DEEPSEEK_API_KEY (summary) set.      */
/* ------------------------------------------------------------------ */

export type AudioCallView = {
  id: string;
  leadId: string | null;
  leadName: string;
  company: string;
  owner: string;
  phone: string;
  direction: "in" | "out";
  connected: boolean;
  durationSeconds: number;
  recordingUrl: string | null;
  occurredAt: string;
  transcript: string | null;
  aiSummary: string | null;
  nextStep: string | null;
  amocrmTaskId: number | null;
  amocrmId: number | null;
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

export function useAudioAnalyticsView(overrideCalls?: AmoCrmCallRow[]) {
  const { user } = useAuth();
  const { data: liveCalls, isLoading: callsLoading } = useAmoCrmCallsRaw();
  const { rows: leads, isLoading: leadsLoading } = useCrmLeads();
  const isLoading = callsLoading || leadsLoading;

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
          phone: c.phone ?? lead?.phone ?? "",
          direction: c.direction === "in" ? "in" : "out",
          connected: c.connected,
          durationSeconds: c.duration_seconds,
          recordingUrl: c.recording_url,
          occurredAt: timeAgo(c.occurred_at),
          transcript: c.transcript,
          aiSummary: c.ai_summary,
          nextStep: c.next_step,
          amocrmTaskId: c.amocrm_task_id,
          amocrmId: lead?.amocrmId ?? null,
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
  }, [calls, leadsById]);

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

export function usePipelineStageStats() {
  const { data: deals } = useDealsRaw();
  const { data: stages } = usePipelineStagesRaw();
  const visibleOwnerIds = useVisibleOwnerIds();

  return useMemo(() => {
    const rows = visibleOwnerIds
      ? (deals ?? []).filter((d) => !!d.owner_id && visibleOwnerIds.has(d.owner_id))
      : (deals ?? []);
    return (stages ?? []).map((s) => {
      const inStage = rows.filter((d) => d.stage_id === s.id);
      return {
        stage: s.name,
        value: inStage.reduce((sum, d) => sum + Number(d.value), 0),
        deals: inStage.length,
      };
    });
  }, [deals, stages, visibleOwnerIds]);
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

export function useDashboardKpis(
  filters?: DashboardFilters,
  overrides?: { leads?: LeadRow[] | undefined; deals?: DealRow[] | undefined },
) {
  const { data: liveDeals } = useDealsRaw();
  const { data: liveLeads } = useLeadsRaw();
  const { data: stages } = usePipelineStagesRaw();
  const visibleOwnerIds = useVisibleOwnerIds();
  const deals = useMemo(() => {
    const rows = overrides?.deals ?? liveDeals ?? [];
    return visibleOwnerIds
      ? rows.filter((d) => !!d.owner_id && visibleOwnerIds.has(d.owner_id))
      : rows;
  }, [overrides?.deals, liveDeals, visibleOwnerIds]);
  const leads = useMemo(() => {
    const rows = overrides?.leads ?? liveLeads ?? [];
    return visibleOwnerIds
      ? rows.filter((l) => !!l.owner_id && visibleOwnerIds.has(l.owner_id))
      : rows;
  }, [overrides?.leads, liveLeads, visibleOwnerIds]);

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
}

/* ------------------------------------------------------------------ */
/* Business profile — a single shared row used as AI assistant context */
/* ------------------------------------------------------------------ */

export type BusinessProfileRow = Tables["business_profile"]["Row"];

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
          "company_name" | "description" | "competitors" | "terminology" | "tone"
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

export function useTagsSummary() {
  const { data: leads, ...rest } = useLeadsRaw();
  const tags = useMemo<TagSummary[]>(() => {
    const counts = new Map<string, number>();
    for (const l of leads ?? []) {
      for (const tag of l.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [leads]);
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
  const { data: deals, isLoading: dealsLoading } = useDealsRaw();

  const rows = useMemo<NormativeRow[]>(() => {
    const dealRows = deals ?? [];
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
      const won = dealRows.filter((d) => d.owner_id === p.id && d.status === "won" && d.close_date);
      const revenueToday = won
        .filter((d) => new Date(d.close_date!) >= startOfToday)
        .reduce((s, d) => s + Number(d.value), 0);
      const revenueMonth = won
        .filter((d) => new Date(d.close_date!) >= startOfMonth)
        .reduce((s, d) => s + Number(d.value), 0);
      const monthlyTarget = p.monthly_target || 1;
      const monthlyPct = Math.round((revenueMonth / monthlyTarget) * 1000) / 10;
      const expectedByNow = monthlyTarget * expectedPaceFraction;
      const pacePct = Math.round((revenueMonth / Math.max(1, expectedByNow)) * 1000) / 10;
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
  }, [profiles, deals, user]);

  return { rows, isLoading: profilesLoading || dealsLoading };
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
/* Distinct funnel names — for the sidebar's expandable Funnels group. */
/* ------------------------------------------------------------------ */

export function useFunnelNames() {
  const { data: leads, isLoading } = useLeadsRaw();
  const visibleOwnerIds = useVisibleOwnerIds();
  const names = useMemo(() => {
    const set = new Set<string>();
    for (const l of leads ?? []) {
      if (visibleOwnerIds && !(l.owner_id && visibleOwnerIds.has(l.owner_id))) continue;
      set.add(l.funnel || "Direct Sales");
    }
    return Array.from(set).sort();
  }, [leads, visibleOwnerIds]);
  return { names, isLoading };
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
