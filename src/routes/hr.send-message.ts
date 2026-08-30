// Server-only. Sends a message to a candidate through the Kadrlar bo'limi
// Telegram bot and only then logs it, so hr_candidate_messages never shows
// an "outbound" row that Telegram actually rejected.
import { createFileRoute } from "@tanstack/react-router";
import { getRequestUserId } from "@/lib/auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendHrTelegramMessage } from "@/lib/telegram-report.server";

type Body = {
  candidateId?: string;
  text?: string;
};

export const Route = createFileRoute("/hr/send-message")({
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
        if (!caller || (caller.role !== "super_admin" && caller.role !== "platform_owner")) {
          return Response.json({ error: "Unauthorized" }, { status: 403 });
        }

        const body = (await request.json().catch(() => ({}))) as Body;
        const candidateId = body.candidateId?.trim();
        const text = body.text?.trim();
        if (!candidateId || !text) {
          return Response.json({ error: "candidateId va text talab qilinadi." }, { status: 400 });
        }

        const { data: candidate } = await supabaseAdmin
          .from("hr_candidates")
          .select("id, organization_id, telegram_chat_id")
          .eq("id", candidateId)
          .maybeSingle();
        if (!candidate) return Response.json({ error: "Nomzod topilmadi." }, { status: 404 });
        if (
          caller.role !== "platform_owner" &&
          candidate.organization_id !== caller.organization_id
        ) {
          return Response.json({ error: "Unauthorized" }, { status: 403 });
        }

        try {
          await sendHrTelegramMessage(candidate.telegram_chat_id, text);
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Telegramga yuborib bo'lmadi." },
            { status: 502 },
          );
        }

        const { data: message, error } = await supabaseAdmin
          .from("hr_candidate_messages")
          .insert({
            organization_id: candidate.organization_id,
            candidate_id: candidate.id,
            direction: "outbound",
            body: text,
            sent_by: userId,
          })
          .select()
          .single();
        if (error) return Response.json({ error: error.message }, { status: 500 });

        return Response.json(message, { status: 200 });
      },
    },
  },
});
