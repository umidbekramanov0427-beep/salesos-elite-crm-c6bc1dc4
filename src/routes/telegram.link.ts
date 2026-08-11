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
        const { data: caller, error } = await supabaseAdmin
          .from("profiles")
          .update({ telegram_link_code: code, telegram_chat_id: null })
          .eq("id", userId)
          .select("organization_id")
          .single();
        if (error) return Response.json({ error: error.message }, { status: 400 });

        const { data: botSetting } = caller.organization_id
          ? await supabaseAdmin
              .from("integration_settings")
              .select("config")
              .eq("organization_id", caller.organization_id)
              .eq("key", "telegram_bot")
              .maybeSingle()
          : { data: null };
        const config = (botSetting?.config ?? {}) as { username?: string };

        return Response.json({ code, botUsername: config.username ?? null });
      },
    },
  },
});
