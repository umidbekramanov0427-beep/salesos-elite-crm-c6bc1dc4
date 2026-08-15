import { createFileRoute } from "@tanstack/react-router";
import { requireOrgMember } from "@/lib/auth.server";
import { fetchOpenTaskStats } from "@/lib/amocrm/client.server";

export const Route = createFileRoute("/dashboard/amocrm-tasks")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const member = await requireOrgMember(request);
          if (!member) {
            return Response.json({ error: "Not signed in." }, { status: 401 });
          }
          const funnel = new URL(request.url).searchParams.get("funnel");
          const stats = await fetchOpenTaskStats(member.organizationId, funnel);
          return Response.json(stats);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return Response.json({ dueToday: 0, overdue: 0, error: message }, { status: 500 });
        }
      },
    },
  },
});
