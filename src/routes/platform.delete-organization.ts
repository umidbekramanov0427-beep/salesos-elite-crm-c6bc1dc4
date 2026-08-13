import { createFileRoute } from "@tanstack/react-router";
import { requirePlatformOwner } from "@/lib/auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Body = {
  id?: string;
};

export const Route = createFileRoute("/platform/delete-organization")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ownerId = await requirePlatformOwner(request);
        if (!ownerId) return Response.json({ error: "Unauthorized" }, { status: 403 });

        const body = (await request.json().catch(() => ({}))) as Body;
        const id = body.id?.trim();
        if (!id) return Response.json({ error: "Company id is required." }, { status: 400 });

        const { data: org } = await supabaseAdmin
          .from("organizations")
          .select("id")
          .eq("id", id)
          .maybeSingle();
        if (!org) return Response.json({ error: "Company not found." }, { status: 404 });

        // Delete every member's auth account first (cascades to their
        // profiles row) via the same Auth Admin API path
        // admin.delete-employee.ts already uses — proven, not raw SQL
        // against the auth schema.
        const { data: members } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("organization_id", id);
        for (const member of members ?? []) {
          const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(member.id);
          if (deleteUserError) {
            return Response.json(
              { error: `Failed to remove a company member: ${deleteUserError.message}` },
              { status: 400 },
            );
          }
        }

        // Everything else (leads, deals, contacts, tasks, calls, audit
        // trail, settings, and finally the organization row itself) in one
        // transaction — see the migration for why this can't just be a
        // plain `delete from organizations`.
        const { error: dataError } = await supabaseAdmin.rpc("delete_organization_data", {
          target_org_id: id,
        });
        if (dataError) return Response.json({ error: dataError.message }, { status: 400 });

        return Response.json({ ok: true }, { status: 200 });
      },
    },
  },
});
