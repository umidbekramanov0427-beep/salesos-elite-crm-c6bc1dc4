import { createFileRoute } from "@tanstack/react-router";
import { requirePlatformOwner } from "@/lib/auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Lazily flips a company inactive once its trial has passed — called from
// the Platform page on load rather than on a schedule, since we have no
// cron dependency available here. Gated to the platform owner so it can't
// be triggered by an arbitrary signed-in user.
export const Route = createFileRoute("/platform/deactivate-expired-trials")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ownerId = await requirePlatformOwner(request);
        if (!ownerId) return Response.json({ error: "Unauthorized" }, { status: 403 });

        const { error } = await supabaseAdmin
          .from("organizations")
          .update({ active: false })
          .eq("active", true)
          .not("trial_ends_at", "is", null)
          .lt("trial_ends_at", new Date().toISOString());
        if (error) return Response.json({ error: error.message }, { status: 500 });

        return Response.json({ ok: true });
      },
    },
  },
});
