import { ToolError, type ToolContext } from "@lovable.dev/mcp-js";

/**
 * Every tool in this MCP server reads real CRM data, which is now scoped
 * per-company — resolve the authenticated caller's own organization and
 * throw rather than silently returning another company's rows.
 */
export async function requireToolOrgId(ctx: ToolContext): Promise<string> {
  const userId = ctx.getUserId();
  if (!userId) throw new ToolError("This tool call is not authenticated.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.organization_id) throw new ToolError("No organization found for this user.");
  return profile.organization_id;
}
