import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTelegramMessage } from "@/lib/telegram-report.server";

type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: { id?: number };
  };
};

const CODE_RE = /[A-Z0-9]{8}/;

export const Route = createFileRoute("/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["TELEGRAM_WEBHOOK_SECRET"];
        if (expected) {
          const got = request.headers.get("x-telegram-bot-api-secret-token");
          if (got !== expected) return Response.json({ ok: false }, { status: 401 });
        }

        const update = (await request.json().catch(() => ({}))) as TelegramUpdate;
        const chatId = update.message?.chat?.id;
        const text = (update.message?.text ?? "").toUpperCase();
        if (!chatId) return Response.json({ ok: true });

        const match = text.match(CODE_RE);
        if (!match) {
          await sendTelegramMessage(
            chatId,
            "Ulash kodini topolmadim. SalesOS Elite ➝ Sozlamalar ➝ Telegram bot bo'limidan kodni oling va shu yerga yuboring.",
          ).catch(() => undefined);
          return Response.json({ ok: true });
        }

        const code = match[0];
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name")
          .eq("telegram_link_code", code)
          .maybeSingle();

        if (!profile) {
          await sendTelegramMessage(
            chatId,
            "Bu kod topilmadi yoki eskirgan. Sozlamalardan yangi kod oling.",
          ).catch(() => undefined);
          return Response.json({ ok: true });
        }

        await supabaseAdmin
          .from("profiles")
          .update({ telegram_chat_id: chatId, telegram_link_code: null })
          .eq("id", profile.id);

        await sendTelegramMessage(
          chatId,
          `✅ Ulandi! Endi kunlik hisobotlar shu yerga keladi, ${profile.full_name || "hurmatli foydalanuvchi"}.`,
        ).catch(() => undefined);

        return Response.json({ ok: true });
      },
    },
  },
});
