import { createFileRoute } from "@tanstack/react-router";
import { requireSuperAdmin } from "@/lib/auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database, Json } from "@/integrations/supabase/types";

type AiAgentInsert = Database["public"]["Tables"]["ai_agents"]["Insert"];

// Client-side upserts to ai_agents kept failing RLS ("new row violates
// row-level security policy") for a confirmed super_admin whose
// organization_id matched exactly what the policy checks -- two attempts
// at the policy shape didn't resolve it, so this sidesteps client-side RLS
// entirely: auth is enforced here (requireSuperAdmin, the same check used
// by /integrations/amocrm/sync), and the actual write goes through the
// service-role client, matching the pattern already proven to work
// elsewhere in this app instead of depending on the RLS mystery.
export const Route = createFileRoute("/admin/ai-agents/update")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const admin = await requireSuperAdmin(request);
          if (!admin) {
            return Response.json({ error: "Only admins can change this." }, { status: 403 });
          }

          const body = (await request.json()) as {
            kind: "chat" | "call";
            model?: string;
            system_prompt?: string;
            channels?: string[];
            active?: boolean;
            call_instructions?: Record<string, unknown>;
          };
          if (body.kind !== "chat" && body.kind !== "call") {
            return Response.json({ error: "Invalid kind." }, { status: 400 });
          }

          const row: AiAgentInsert = {
            organization_id: admin.organizationId,
            kind: body.kind,
            updated_by: admin.id,
          };
          if (body.model !== undefined) row.model = body.model;
          if (body.system_prompt !== undefined) row.system_prompt = body.system_prompt;
          if (body.channels !== undefined) row.channels = body.channels;
          if (body.active !== undefined) row.active = body.active;
          if (body.call_instructions !== undefined)
            row.call_instructions = body.call_instructions as Json;

          const { error } = await supabaseAdmin
            .from("ai_agents")
            .upsert(row, { onConflict: "organization_id,kind" });
          if (error) return Response.json({ error: error.message }, { status: 500 });

          return Response.json({ ok: true });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
