import { createFileRoute } from "@tanstack/react-router";
import { buildAuthorizeUrl } from "@/lib/amocrm/client.server";

export const Route = createFileRoute("/integrations/amocrm/connect")({
  server: {
    handlers: {
      GET: async () => {
        const state = crypto.randomUUID();
        try {
          return new Response(null, {
            status: 302,
            headers: { location: buildAuthorizeUrl(state) },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "AmoCRM is not configured.";
          return new Response(message, { status: 500 });
        }
      },
    },
  },
});
