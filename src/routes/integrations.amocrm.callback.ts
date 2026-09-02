import { createFileRoute } from "@tanstack/react-router";
import { exchangeCodeForTokens } from "@/lib/amocrm/client.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/integrations/amocrm/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        // AmoCRM sends the account's subdomain back as `referer`, e.g. "mysubdomain.amocrm.ru".
        const referer = url.searchParams.get("referer");
        // Echoed back verbatim from the state we sent — see connect.ts.
        const state = url.searchParams.get("state");
        const organizationId = state?.split(".")[0];

        if (!code || !referer || !organizationId) {
          return new Response(
            "AmoCRM did not send a code/referer/state. Open this page again from the AmoCRM integration screen.",
            { status: 400 },
          );
        }

        try {
          const tokens = await exchangeCodeForTokens(code, referer, organizationId);
          const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

          const { error: connError } = await supabaseAdmin.from("amocrm_connection").upsert({
            organization_id: organizationId,
            subdomain: referer,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_expires_at: expiresAt,
            connected_at: new Date().toISOString(),
            last_sync_error: null,
          });
          if (connError) throw connError;

          const { error: settingsError } = await supabaseAdmin
            .from("integration_settings")
            .update({ enabled: true, config: { subdomain: referer } })
            .eq("organization_id", organizationId)
            .eq("key", "amocrm");
          if (settingsError) throw settingsError;
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return new Response(`AmoCRM connection failed: ${message}`, { status: 500 });
        }

        return new Response(null, {
          status: 302,
          headers: { location: "/integrations?amocrm=connected" },
        });
      },
    },
  },
});
