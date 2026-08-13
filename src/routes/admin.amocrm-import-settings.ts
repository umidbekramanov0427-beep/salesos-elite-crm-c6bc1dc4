import { createFileRoute } from "@tanstack/react-router";
import { requireSuperAdmin } from "@/lib/auth.server";
import { saveAmoImportSettings } from "@/lib/amocrm/client.server";

type Body = { pipelineIds?: unknown; userIds?: unknown };

function toNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is number => typeof v === "number");
}

export const Route = createFileRoute("/admin/amocrm-import-settings")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const admin = await requireSuperAdmin(request);
        if (!admin) return Response.json({ error: "Unauthorized" }, { status: 403 });

        const body = (await request.json().catch(() => ({}))) as Body;
        const pipelineIds = toNumberArray(body.pipelineIds);
        const userIds = toNumberArray(body.userIds);

        try {
          await saveAmoImportSettings(admin.organizationId, pipelineIds, userIds);
          return Response.json({ ok: true }, { status: 200 });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Could not save.";
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  },
});
