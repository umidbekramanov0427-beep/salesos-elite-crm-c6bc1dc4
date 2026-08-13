import { createFileRoute } from "@tanstack/react-router";
import { requirePlatformOwner } from "@/lib/auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Body = {
  id?: string;
};

export const Route = createFileRoute("/platform/delete-user")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ownerId = await requirePlatformOwner(request);
        if (!ownerId) return Response.json({ error: "Unauthorized" }, { status: 403 });

        const body = (await request.json().catch(() => ({}))) as Body;
        const id = body.id?.trim();
        if (!id) return Response.json({ error: "User id is required." }, { status: 400 });
        if (id === ownerId) {
          return Response.json({ error: "You cannot delete your own account." }, { status: 400 });
        }

        const { data: target } = await supabaseAdmin
          .from("profiles")
          .select("role")
          .eq("id", id)
          .maybeSingle();
        if (!target) return Response.json({ error: "User not found." }, { status: 404 });
        if (target.role === "platform_owner") {
          return Response.json(
            { error: "Platform owner accounts can't be deleted here." },
            { status: 400 },
          );
        }

        const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
        if (error) return Response.json({ error: error.message }, { status: 400 });

        return Response.json({ ok: true }, { status: 200 });
      },
    },
  },
});
