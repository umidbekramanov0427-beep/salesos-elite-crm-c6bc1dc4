import { createFileRoute } from "@tanstack/react-router";
import { getRequestUserId } from "@/lib/auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function randomCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

export const Route = createFileRoute("/telegram/link")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await getRequestUserId(request);
        if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const code = randomCode();
        const { error } = await supabaseAdmin
          .from("profiles")
          .update({ telegram_link_code: code, telegram_chat_id: null })
          .eq("id", userId);
        if (error) return Response.json({ error: error.message }, { status: 400 });

        const { data: botSetting } = await supabaseAdmin
          .from("integration_settings")
          .select("config")
          .eq("key", "telegram_bot")
          .maybeSingle();
        const config = (botSetting?.config ?? {}) as { username?: string };

        return Response.json({ code, botUsername: config.username ?? null });
      },
    },
  },
});
