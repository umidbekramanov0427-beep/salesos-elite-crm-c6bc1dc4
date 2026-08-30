// Server-only. Manual "Hisobotni hoziroq yaratish" trigger -- builds and
// delivers today's full report for the caller's own org right now, instead
// of waiting for the scheduled send_time. Reuses the exact same delivery
// path (history save, Google Sheets push, Telegram sends) as the scheduled
// job via sendDailyReportForOrg, so the two can never drift apart.
import { createFileRoute } from "@tanstack/react-router";
import { getRequestUserId } from "@/lib/auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendDailyReportForOrg } from "@/lib/telegram-report.server";

export const Route = createFileRoute("/daily-report-settings/generate-now")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await getRequestUserId(request);
        if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const { data: caller } = await supabaseAdmin
          .from("profiles")
          .select("role, organization_id")
          .eq("id", userId)
          .maybeSingle();
        if (!caller || caller.role !== "super_admin") {
          return Response.json({ error: "Unauthorized" }, { status: 403 });
        }
        if (!caller.organization_id) {
          return Response.json({ error: "Kompaniya topilmadi." }, { status: 400 });
        }

        try {
          const result = await sendDailyReportForOrg(caller.organization_id);
          return Response.json(result);
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Hisobotni yaratib bo'lmadi." },
            { status: 500 },
          );
        }
      },
    },
  },
});
