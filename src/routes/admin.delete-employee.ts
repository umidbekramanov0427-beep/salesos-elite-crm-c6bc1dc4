import { createFileRoute } from "@tanstack/react-router";
import { requireSuperAdmin } from "@/lib/auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Body = {
  id?: string;
};

export const Route = createFileRoute("/admin/delete-employee")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const admin = await requireSuperAdmin(request);
        if (!admin) return Response.json({ error: "Unauthorized" }, { status: 403 });

        const body = (await request.json().catch(() => ({}))) as Body;
        const id = body.id?.trim();
        if (!id) return Response.json({ error: "Employee id is required." }, { status: 400 });
        if (id === admin.id) {
          return Response.json({ error: "You cannot delete your own account." }, { status: 400 });
        }

        const { data: target } = await supabaseAdmin
          .from("profiles")
          .select("organization_id")
          .eq("id", id)
          .maybeSingle();
        if (!target || target.organization_id !== admin.organizationId) {
          return Response.json({ error: "Employee not found." }, { status: 404 });
        }

        const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
        if (error) return Response.json({ error: error.message }, { status: 400 });

        return Response.json({ ok: true }, { status: 200 });
      },
    },
  },
});
