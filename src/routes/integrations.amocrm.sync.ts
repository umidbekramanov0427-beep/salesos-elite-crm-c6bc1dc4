import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { syncLeadsFromAmo } from "@/lib/amocrm/client.server";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

async function currentUserId(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  if (token.split(".").length !== 3) return null;

  const SUPABASE_URL = process.env["SUPABASE_URL"];
  const SUPABASE_PUBLISHABLE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (
          isNewSupabaseApiKey(SUPABASE_PUBLISHABLE_KEY) &&
          headers.get("Authorization") === `Bearer ${SUPABASE_PUBLISHABLE_KEY}`
        ) {
          headers.delete("Authorization");
        }
        headers.set("apikey", SUPABASE_PUBLISHABLE_KEY);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub;
}

export const Route = createFileRoute("/integrations/amocrm/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await currentUserId(request);
        if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle();
        if (profile?.role !== "super_admin") {
          return Response.json({ error: "Only admins can trigger a sync." }, { status: 403 });
        }

        const result = await syncLeadsFromAmo();
        return Response.json(result, { status: result.error ? 500 : 200 });
      },
    },
  },
});
