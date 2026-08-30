// Server-only. Serves the real "Hisobot namunasi" preview shown on the
// Kunlik hisobot sozlamalari page. The actual report-building logic lives in
// daily-report-builder.server.ts so this preview and the real scheduled
// Telegram send (telegram.send-daily-report.ts) never drift apart.
import { createFileRoute } from "@tanstack/react-router";
import { getRequestUserId } from "@/lib/auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildFullDailyReport } from "@/lib/daily-report-builder.server";

export const Route = createFileRoute("/daily-report-settings/preview")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await getRequestUserId(request);
        if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const { data: caller } = await supabaseAdmin
          .from("profiles")
          .select("organization_id")
          .eq("id", userId)
          .maybeSingle();
        if (!caller?.organization_id)
          return Response.json({ error: "Unauthorized" }, { status: 401 });

        const result = await buildFullDailyReport(caller.organization_id);
        return Response.json(result);
      },
    },
  },
});
