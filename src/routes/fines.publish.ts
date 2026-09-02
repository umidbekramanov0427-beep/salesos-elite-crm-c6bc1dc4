import { createFileRoute } from "@tanstack/react-router";
import { getRequestUserId } from "@/lib/auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTelegramMessage } from "@/lib/telegram-report.server";

type FineRow = {
  amount: number;
  fine_type_id: string;
  profile_id: string;
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const Route = createFileRoute("/fines/publish")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await getRequestUserId(request);
        if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const { data: admin } = await supabaseAdmin
          .from("profiles")
          .select("role, organization_id")
          .eq("id", userId)
          .maybeSingle();
        const isManager =
          admin?.role === "super_admin" ||
          admin?.role === "platform_owner" ||
          admin?.role === "rop";
        if (!isManager || !admin?.organization_id) {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }
        const organizationId = admin.organization_id;

        const body = (await request.json().catch(() => ({}))) as {
          from?: string | null;
          to?: string | null;
          label?: string;
        };

        let finesQuery = supabaseAdmin
          .from("fines")
          .select("amount, fine_type_id, profile_id")
          .eq("organization_id", organizationId);
        if (body.from) finesQuery = finesQuery.gte("occurred_on", body.from.slice(0, 10));
        if (body.to) finesQuery = finesQuery.lte("occurred_on", body.to.slice(0, 10));
        const { data: fines, error: finesError } = await finesQuery.returns<FineRow[]>();
        if (finesError) return Response.json({ error: finesError.message }, { status: 500 });

        const { data: fineTypes } = await supabaseAdmin
          .from("fine_types")
          .select("id, name")
          .eq("organization_id", organizationId);
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name, email")
          .eq("organization_id", organizationId);

        const typeName = new Map((fineTypes ?? []).map((t) => [t.id, t.name]));
        const profileName = new Map(
          (profiles ?? []).map((p) => [p.id, p.full_name || p.email || "—"]),
        );

        const byProfile = new Map<
          string,
          { name: string; total: number; byType: Map<string, number> }
        >();
        for (const f of fines ?? []) {
          const entry = byProfile.get(f.profile_id) ?? {
            name: profileName.get(f.profile_id) ?? "—",
            total: 0,
            byType: new Map<string, number>(),
          };
          entry.total += Number(f.amount);
          entry.byType.set(
            f.fine_type_id,
            (entry.byType.get(f.fine_type_id) ?? 0) + Number(f.amount),
          );
          byProfile.set(f.profile_id, entry);
        }

        const rows = [...byProfile.values()].sort((a, b) => b.total - a.total);
        const lines: string[] = [`<b>💰 Jarimalar — ${escapeHtml(body.label || "")}</b>`, ""];
        if (rows.length === 0) {
          lines.push("Tanlangan davrda jarima yo'q.");
        } else {
          for (const r of rows) {
            const details = [...r.byType.entries()]
              .map(([typeId, amt]) => `${escapeHtml(typeName.get(typeId) ?? "?")}: ${amt}`)
              .join(", ");
            lines.push(`<b>${escapeHtml(r.name)}</b> — ${r.total} (${details})`);
          }
        }
        const text = lines.join("\n");

        const { data: recipients } = await supabaseAdmin
          .from("profiles")
          .select("telegram_chat_id")
          .eq("organization_id", organizationId)
          .not("telegram_chat_id", "is", null);

        let sent = 0;
        for (const r of recipients ?? []) {
          if (!r.telegram_chat_id) continue;
          try {
            await sendTelegramMessage(r.telegram_chat_id, text);
            sent++;
          } catch {
            // A single bad chat id must never block the rest of the broadcast.
          }
        }

        return Response.json({ ok: true, sent });
      },
    },
  },
});
