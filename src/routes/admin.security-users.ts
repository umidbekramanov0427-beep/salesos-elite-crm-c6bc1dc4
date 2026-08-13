import { createFileRoute } from "@tanstack/react-router";
import { requireSuperAdmin } from "@/lib/auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// last_sign_in_at / banned_until live on auth.users, not the public.profiles
// table the client can read directly — this is the only place that data is
// exposed, service-role only, scoped to the caller's own org's profile ids
// so one org's admin can never see another org's login activity.
export const Route = createFileRoute("/admin/security-users")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const admin = await requireSuperAdmin(request);
        if (!admin) return Response.json({ error: "Unauthorized" }, { status: 403 });

        const { data: profiles, error } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("organization_id", admin.organizationId);
        if (error) return Response.json({ error: error.message }, { status: 400 });

        const results = await Promise.all(
          (profiles ?? []).map(async (p) => {
            const { data } = await supabaseAdmin.auth.admin.getUserById(p.id);
            return {
              id: p.id,
              last_sign_in_at: data.user?.last_sign_in_at ?? null,
              banned_until: data.user?.banned_until ?? null,
            };
          }),
        );

        return Response.json({ users: results }, { status: 200 });
      },
    },
  },
});
