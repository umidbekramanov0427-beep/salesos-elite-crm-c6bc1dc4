import { createFileRoute } from "@tanstack/react-router";
import { requireSuperAdmin } from "@/lib/auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Body = { userId?: string; ban?: boolean };

// Supabase's Admin API has no per-session "sign this device out" call keyed
// by user id (auth.admin.signOut needs the user's own JWT, which the admin
// never has) — ban_duration is the real, working equivalent: it rejects
// every future token refresh for that account, which is what actually
// matters for locking someone out.
const BAN_DURATION = "876000h"; // ~100 years — GoTrue's own convention for "indefinite"

export const Route = createFileRoute("/admin/security-ban")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const admin = await requireSuperAdmin(request);
        if (!admin) return Response.json({ error: "Unauthorized" }, { status: 403 });

        const body = (await request.json().catch(() => ({}))) as Body;
        const userId = body.userId?.trim();
        if (!userId) return Response.json({ error: "userId is required." }, { status: 400 });
        if (userId === admin.id) {
          return Response.json({ error: "You can't block your own account." }, { status: 400 });
        }

        const { data: target } = await supabaseAdmin
          .from("profiles")
          .select("organization_id")
          .eq("id", userId)
          .maybeSingle();
        if (!target || target.organization_id !== admin.organizationId) {
          return Response.json({ error: "User not found." }, { status: 404 });
        }

        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: body.ban ? BAN_DURATION : "none",
        });
        if (error) return Response.json({ error: error.message }, { status: 400 });

        return Response.json({ ok: true }, { status: 200 });
      },
    },
  },
});
