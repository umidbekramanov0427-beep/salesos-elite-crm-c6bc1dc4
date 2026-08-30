// Server-only. Permanently deletes a candidate (cascades to their answers,
// status history, and chat messages) -- but only after logging a full
// snapshot plus the caller-supplied reason into hr_candidate_deletions, so
// the deletion itself stays traceable even though the candidate record
// doesn't. Runs via supabaseAdmin (not the authenticated client) since
// hr_candidates has no delete policy for authenticated users -- keeping
// this destructive path server-side, gated by an explicit role check,
// mirrors hr.send-message.ts.
import { createFileRoute } from "@tanstack/react-router";
import { getRequestUserId } from "@/lib/auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Body = {
  candidateId?: string;
  reason?: string;
};

export const Route = createFileRoute("/hr/delete-candidate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await getRequestUserId(request);
        if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const { data: caller } = await supabaseAdmin
          .from("profiles")
          .select("role, organization_id")
          .eq("id", userId)
          .maybeSingle();
        if (!caller || (caller.role !== "super_admin" && caller.role !== "platform_owner")) {
          return Response.json({ error: "Unauthorized" }, { status: 403 });
        }

        const body = (await request.json().catch(() => ({}))) as Body;
        const candidateId = body.candidateId?.trim();
        const reason = body.reason?.trim();
        if (!candidateId) {
          return Response.json({ error: "candidateId talab qilinadi." }, { status: 400 });
        }
        if (!reason) {
          return Response.json({ error: "O'chirish sababi talab qilinadi." }, { status: 400 });
        }

        const { data: candidate } = await supabaseAdmin
          .from("hr_candidates")
          .select(
            "*, hr_vacancies(title), hr_candidate_answers(answer_text, hr_questions(question))",
          )
          .eq("id", candidateId)
          .maybeSingle();
        if (!candidate) return Response.json({ error: "Nomzod topilmadi." }, { status: 404 });
        if (
          caller.role !== "platform_owner" &&
          candidate.organization_id !== caller.organization_id
        ) {
          return Response.json({ error: "Unauthorized" }, { status: 403 });
        }

        const { error: logError } = await supabaseAdmin.from("hr_candidate_deletions").insert({
          organization_id: candidate.organization_id,
          candidate_snapshot: candidate,
          reason,
          deleted_by: userId,
        });
        if (logError) return Response.json({ error: logError.message }, { status: 500 });

        const { error: deleteError } = await supabaseAdmin
          .from("hr_candidates")
          .delete()
          .eq("id", candidateId);
        if (deleteError) return Response.json({ error: deleteError.message }, { status: 500 });

        return Response.json({ ok: true });
      },
    },
  },
});
