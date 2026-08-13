import { createFileRoute } from "@tanstack/react-router";
import { requireSuperAdmin } from "@/lib/auth.server";
import { fetchAmoCatalog } from "@/lib/amocrm/client.server";

export const Route = createFileRoute("/admin/amocrm-catalog")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const admin = await requireSuperAdmin(request);
        if (!admin) return Response.json({ error: "Unauthorized" }, { status: 403 });

        try {
          const catalog = await fetchAmoCatalog(admin.organizationId);
          return Response.json(catalog, { status: 200 });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Could not load AmoCRM catalog.";
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  },
});
