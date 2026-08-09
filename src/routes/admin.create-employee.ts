import { createFileRoute } from "@tanstack/react-router";
import { requireSuperAdmin } from "@/lib/auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Body = {
  email?: string;
  password?: string;
  full_name?: string;
};

export const Route = createFileRoute("/admin/create-employee")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const adminId = await requireSuperAdmin(request);
        if (!adminId) return Response.json({ error: "Unauthorized" }, { status: 403 });

        const body = (await request.json().catch(() => ({}))) as Body;
        const email = body.email?.trim();
        const password = body.password;
        const fullName = body.full_name?.trim() ?? "";

        if (!email || !password || password.length < 8) {
          return Response.json(
            { error: "Email and an 8+ character password are required." },
            { status: 400 },
          );
        }

        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        });
        if (error || !data.user) {
          return Response.json(
            { error: error?.message ?? "Could not create the account." },
            { status: 400 },
          );
        }

        return Response.json({ id: data.user.id }, { status: 200 });
      },
    },
  },
});
