import { createFileRoute } from "@tanstack/react-router";
import { upsertSingleAmoLead } from "@/lib/amocrm/client.server";

// AmoCRM posts form-encoded fields like leads[add][0][id], leads[update][0][name] ...
const FIELD_PATTERN = /^leads\[(?:add|update)\]\[(\d+)\]\[(id|name|price)\]$/;

export const Route = createFileRoute("/integrations/amocrm/webhook")({
  server: {
    handlers: {
      // AmoCRM expects a fast 200 regardless of outcome, or it retries aggressively.
      POST: async ({ request }) => {
        try {
          const form = await request.formData();
          const byIndex = new Map<string, { id?: string; name?: string; price?: string }>();

          for (const [key, value] of form.entries()) {
            const match = FIELD_PATTERN.exec(key);
            if (!match) continue;
            const index = match[1]!;
            const field = match[2] as "id" | "name" | "price";
            const entry = byIndex.get(index) ?? {};
            entry[field] = String(value);
            byIndex.set(index, entry);
          }

          for (const entry of byIndex.values()) {
            if (!entry.id) continue;
            await upsertSingleAmoLead(
              Number(entry.id),
              entry.name ?? null,
              entry.price ? Number(entry.price) : null,
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
