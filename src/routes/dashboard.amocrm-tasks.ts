import { createFileRoute } from "@tanstack/react-router";
import { getRequestUserId } from "@/lib/auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchOpenTaskStats } from "@/lib/amocrm/client.server";

// null = unrestricted (super_admin/platform_owner sees the whole org); a
// rop only ever gets their own subordinates' tasks, everyone else only
// their own -- same scoping rule applied everywhere else in the app
// (useVisibleOwnerIds on the client, visibleOwnerIds in ai-assistant.chat.ts),
// mirrored here since this route runs under the service-role client and
// bypasses RLS entirely.
async function visibleOwnerIds(
  orgId: string,
  callerId: string,
  role: string,
): Promise<string[] | null> {
  if (role === "super_admin" || role === "platform_owner") return null;
  if (role === "rop") {
    const { data: reports } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("organization_id", orgId)
      .eq("manager_id", callerId);
    return [callerId, ...(reports ?? []).map((r) => r.id)];
  }
  return [callerId];
}

export const Route = createFileRoute("/dashboard/amocrm-tasks")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const userId = await getRequestUserId(request);
          if (!userId) return Response.json({ error: "Not signed in." }, { status: 401 });

          const { data: caller } = await supabaseAdmin
            .from("profiles")
            .select("organization_id, role")
            .eq("id", userId)
            .maybeSingle();
          if (!caller?.organization_id) {
            return Response.json({ error: "Not signed in." }, { status: 401 });
          }

          const funnel = new URL(request.url).searchParams.get("funnel");
          const ownerIds = await visibleOwnerIds(caller.organization_id, userId, caller.role);
          const stats = await fetchOpenTaskStats(caller.organization_id, funnel, ownerIds);
          return Response.json(stats);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return Response.json({ dueToday: 0, overdue: 0, error: message }, { status: 500 });
        }
      },
    },
  },
});
