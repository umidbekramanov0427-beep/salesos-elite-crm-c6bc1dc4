import { createFileRoute } from "@tanstack/react-router";
import { getRequestUserId } from "@/lib/auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createAmoTask } from "@/lib/amocrm/client.server";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(`Missing environment variable: ${name}. Add it in Settings -> Secrets.`);
  return value;
}

// Whisper does the ear (audio -> text); DeepSeek does the reading (text ->
// topic/mood/next-step summary) — matching the provider the rest of the
// platform's AI features (ai-assistant.chat.ts) already use.
async function transcribeAudio(recordingUrl: string): Promise<string> {
  const apiKey = requireEnv("OPENAI_API_KEY");

  const audioRes = await fetch(recordingUrl);
  if (!audioRes.ok) throw new Error("Ovoz yozuvini yuklab bo'lmadi (recording_url ishlamayapti).");
  const audioBlob = await audioRes.blob();

  const form = new FormData();
  form.append("file", audioBlob, "call.mp3");
  form.append("model", "whisper-1");
  // Most calls on this platform are in Uzbek; giving Whisper the language
  // up front (instead of letting it auto-detect) measurably improves
  // accuracy for lower-resource languages like Uzbek.
  form.append("language", "uz");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Whisper transcription error (${res.status}): ${text}`);
  }
  const json = (await res.json()) as { text?: string };
  return json.text?.trim() ?? "";
}

const JSON_INSTRUCTION =
  "\n\nJavobni faqat quyidagi JSON formatida qaytar, boshqa hech qanday matn yozma:\n" +
  '{"summary": "qo\'ng\'iroq mavzusi va mijoz kayfiyati haqida qisqa xulosa", ' +
  '"next_step": "menejer keyin aniq nima qilishi kerak — bitta lo\'nda jumla"}';

async function summarizeTranscript(
  transcript: string,
  systemPrompt: string,
): Promise<{ summary: string; nextStep: string | null }> {
  const apiKey = requireEnv("DEEPSEEK_API_KEY");

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt + JSON_INSTRUCTION },
        { role: "user", content: transcript },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DeepSeek error (${res.status}): ${text}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content?.trim() ?? "";

  try {
    const parsed = JSON.parse(content) as { summary?: string; next_step?: string };
    if (parsed.summary) {
      return { summary: parsed.summary.trim(), nextStep: parsed.next_step?.trim() || null };
    }
  } catch {
    // Model didn't return valid JSON (can happen with a heavily customized
    // agent prompt) — fall back to treating the raw text as the summary.
  }
  return { summary: content, nextStep: null };
}

export const Route = createFileRoute("/audio-analytics/analyze")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await getRequestUserId(request);
        if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const { data: caller } = await supabaseAdmin
          .from("profiles")
          .select("organization_id")
          .eq("id", userId)
          .maybeSingle();
        if (!caller?.organization_id)
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        const organizationId = caller.organization_id;

        const body = (await request.json().catch(() => ({}))) as { callId?: string };
        if (!body.callId) return Response.json({ error: "callId is required." }, { status: 400 });

        const { data: call } = await supabaseAdmin
          .from("amocrm_calls")
          .select("id, recording_url, source, amocrm_task_id, leads:lead_id(amocrm_id, owner_id)")
          .eq("id", body.callId)
          .eq("organization_id", organizationId)
          .maybeSingle();
        if (!call) return Response.json({ error: "Call not found." }, { status: 404 });
        if (!call.recording_url) {
          return Response.json({ error: "Bu qo'ng'iroqda ovoz yozuvi yo'q." }, { status: 400 });
        }

        const { data: agent } = await supabaseAdmin
          .from("ai_agents")
          .select("system_prompt, active")
          .eq("organization_id", organizationId)
          .eq("kind", "call")
          .maybeSingle();
        if (agent && agent.active === false) {
          return Response.json(
            { error: "Qo'ng'iroq tahlili AI agenti o'chirilgan. Admin panelidan yoqing." },
            { status: 400 },
          );
        }
        const systemPrompt =
          agent?.system_prompt?.trim() ||
          "Siz qo'ng'iroq yozuvini tahlil qiluvchi yordamchisiz. Asosiy mavzuni, mijoz kayfiyatini va keyingi qadamni qisqa xulosa qiling.";

        try {
          const transcript = await transcribeAudio(call.recording_url);
          if (!transcript) {
            return Response.json(
              { error: "Ovozdan matn chiqmadi (bo'sh yozuv)." },
              { status: 422 },
            );
          }
          const { summary, nextStep } = await summarizeTranscript(transcript, systemPrompt);

          await supabaseAdmin
            .from("amocrm_calls")
            .update({
              transcript,
              ai_summary: summary,
              next_step: nextStep,
              analyzed_at: new Date().toISOString(),
            })
            .eq("id", call.id);

          // Hand the AI-suggested next step to the responsible manager as a
          // reminder inside AmoCRM — best-effort: a failure here shouldn't
          // undo the analysis that's already saved. Skipped for manually
          // uploaded calls (no AmoCRM lead to attach a task to) and never
          // duplicated on re-analysis.
          let taskWarning: string | null = null;
          const leadAmoId = call.leads?.amocrm_id ?? null;
          if (nextStep && call.source === "amocrm" && leadAmoId && !call.amocrm_task_id) {
            try {
              let responsibleAmoUserId: number | null = null;
              if (call.leads?.owner_id) {
                const { data: owner } = await supabaseAdmin
                  .from("profiles")
                  .select("amocrm_user_id")
                  .eq("id", call.leads.owner_id)
                  .maybeSingle();
                responsibleAmoUserId = owner?.amocrm_user_id ?? null;
              }
              const completeTill = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
              const taskId = await createAmoTask(
                organizationId,
                leadAmoId,
                nextStep,
                completeTill,
                responsibleAmoUserId,
              );
              if (taskId) {
                await supabaseAdmin
                  .from("amocrm_calls")
                  .update({ amocrm_task_id: taskId, task_created_at: new Date().toISOString() })
                  .eq("id", call.id);
              }
            } catch (taskErr) {
              taskWarning =
                taskErr instanceof Error ? taskErr.message : "AmoCRM'da vazifa yaratib bo'lmadi.";
            }
          }

          return Response.json({ transcript, summary, nextStep, taskWarning });
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Tahlil qilishda xatolik yuz berdi." },
            { status: 500 },
          );
        }
      },
    },
  },
});
