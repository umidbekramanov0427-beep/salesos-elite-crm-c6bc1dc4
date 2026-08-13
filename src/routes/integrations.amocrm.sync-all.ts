import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { syncLeadsFromAmo } from "@/lib/amocrm/client.server";

// Called on a schedule (see the pg_cron job in the accompanying migration),
// not by a browser — same shared-secret pattern as
// telegram.send-daily-report.ts, since there's no logged-in super_admin
// session to check here. Syncs every organization that has an AmoCRM
// connection, one at a time so one org's failure can't take down the rest.
export const Route = createFileRoute("/integrations/amocrm/sync-all")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["CRON_SECRET"];
        const got = request.headers.get("x-cron-secret");
        if (!expected || got !== expected) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: connections, error } = await supabaseAdmin
          .from("amocrm_connection")
          .select("organization_id");
        if (error) return Response.json({ error: error.message }, { status: 500 });

        const results: { organizationId: string; synced?: number; error?: string }[] = [];
        for (const conn of connections ?? []) {
          try {
            const result = await syncLeadsFromAmo(conn.organization_id);
            results.push({ organizationId: conn.organization_id, ...result });
          } catch (err) {
            results.push({
              organizationId: conn.organization_id,
              error: err instanceof Error ? err.message : "Unknown error",
            });
          }
        }

        return Response.json({ organizations: results.length, results });
      },
    },
  },
});
