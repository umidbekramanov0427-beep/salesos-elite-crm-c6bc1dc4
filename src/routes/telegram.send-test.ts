import { createFileRoute } from "@tanstack/react-router";
import { getRequestUserId } from "@/lib/auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTelegramMessage } from "@/lib/telegram-report.server";
import { buildFullDailyReport, buildPersonalDailyReport } from "@/lib/daily-report-builder.server";

export const Route = createFileRoute("/telegram/send-test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await getRequestUserId(request);
        if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("telegram_chat_id, organization_id, role")
          .eq("id", userId)
          .maybeSingle();
        if (!profile?.telegram_chat_id) {
          return Response.json({ error: "Telegram not linked yet" }, { status: 400 });
        }
        if (!profile.organization_id) {
          return Response.json({ error: "No organization" }, { status: 400 });
        }

        try {
          const text =
            profile.role === "sotuv_menejeri"
              ? await buildPersonalDailyReport(profile.organization_id, userId)
              : (await buildFullDailyReport(profile.organization_id)).text;
          await sendTelegramMessage(profile.telegram_chat_id, text);
          return Response.json({ ok: true });
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Failed to send" },
            { status: 500 },
          );
        }
      },
    },
  },
});
