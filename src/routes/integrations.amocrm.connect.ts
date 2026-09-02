import { createFileRoute } from "@tanstack/react-router";
import { buildAuthorizeUrl } from "@/lib/amocrm/client.server";
import { getUserIdFromToken, requireSuperAdminForUser } from "@/lib/auth.server";

// A plain browser navigation (the "Connect" link) can't carry an
// Authorization header, so the caller's access token is passed as a query
// param instead and resolved here. The organization it resolves to is
// encoded into the OAuth `state` param, which AmoCRM echoes back verbatim
// to the callback — that's how the callback knows which company is
// connecting.
export const Route = createFileRoute("/integrations/amocrm/connect")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token");
        const userId = token ? await getUserIdFromToken(token) : null;
        const admin = userId ? await requireSuperAdminForUser(userId) : null;
        if (!admin) return new Response("Unauthorized", { status: 401 });

        const state = `${admin.organizationId}.${crypto.randomUUID()}`;
        try {
          const authorizeUrl = await buildAuthorizeUrl(state, admin.organizationId);
          return new Response(null, {
            status: 302,
            headers: { location: authorizeUrl },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "AmoCRM is not configured.";
          return new Response(message, { status: 500 });
        }
      },
    },
  },
});
