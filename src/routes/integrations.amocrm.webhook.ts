import { createFileRoute } from "@tanstack/react-router";
import { getConnection, upsertSingleAmoLead } from "@/lib/amocrm/client.server";

// AmoCRM posts form-encoded fields like leads[add][0][id], leads[update][0][name] ...
const FIELD_PATTERN =
  /^leads\[(?:add|update)\]\[(\d+)\]\[(id|name|price|status_id|responsible_user_id|pipeline_id)\]$/;

export const Route = createFileRoute("/integrations/amocrm/webhook")({
  server: {
    handlers: {
      // AmoCRM expects a fast 200 regardless of outcome, or it retries
      // aggressively. The URL AmoCRM posts to must include ?org=<id> — set
      // when connecting (see the "webhook URL" shown after Connect) — since
      // this endpoint no longer belongs to a single workspace.
      POST: async ({ request }) => {
        try {
          const organizationId = new URL(request.url).searchParams.get("org");
          if (!organizationId) return new Response("ok", { status: 200 });
          const conn = await getConnection(organizationId);
          if (!conn) return new Response("ok", { status: 200 });

          const form = await request.formData();
          type Entry = {
            id?: string;
            name?: string;
            price?: string;
            status_id?: string;
            responsible_user_id?: string;
            pipeline_id?: string;
          };
          const byIndex = new Map<string, Entry>();

          for (const [key, value] of form.entries()) {
            const match = FIELD_PATTERN.exec(key);
            if (!match) continue;
            const index = match[1]!;
            const field = match[2] as keyof Entry;
            const entry = byIndex.get(index) ?? {};
            entry[field] = String(value);
            byIndex.set(index, entry);
          }

          for (const entry of byIndex.values()) {
            if (!entry.id) continue;
            await upsertSingleAmoLead(
              organizationId,
              Number(entry.id),
              entry.name ?? null,
              entry.price ? Number(entry.price) : null,
              entry.status_id ? Number(entry.status_id) : null,
              entry.responsible_user_id ? Number(entry.responsible_user_id) : null,
              entry.pipeline_id ? Number(entry.pipeline_id) : null,
            );
          }
        } catch (err) {
          console.error("AmoCRM webhook error", err);
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
