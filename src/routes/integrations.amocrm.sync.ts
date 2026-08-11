import { createFileRoute } from "@tanstack/react-router";
import { requireSuperAdmin } from "@/lib/auth.server";
import { syncLeadsFromAmo } from "@/lib/amocrm/client.server";

export const Route = createFileRoute("/integrations/amocrm/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const admin = await requireSuperAdmin(request);
        if (!admin) {
          return Response.json({ error: "Only admins can trigger a sync." }, { status: 403 });
        }

        const result = await syncLeadsFromAmo(admin.organizationId);
        return Response.json(result, { status: result.error ? 500 : 200 });
      },
    },
  },
});
