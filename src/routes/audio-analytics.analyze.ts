import { createFileRoute } from "@tanstack/react-router";
import { getRequestUserId } from "@/lib/auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

async function summarizeTranscript(transcript: string, systemPrompt: string): Promise<string> {
  const apiKey = requireEnv("DEEPSEEK_API_KEY");

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: transcript },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DeepSeek error (${res.status}): ${text}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

export const Route = createFileRoute("/audio-analytics/analyze")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await getRequestUserId(request);
        if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const body = (await request.json().catch(() => ({}))) as { callId?: string };
        if (!body.callId) return Response.json({ error: "callId is required." }, { status: 400 });

        const { data: call } = await supabaseAdmin
          .from("amocrm_calls")
          .select("id, recording_url")
          .eq("id", body.callId)
          .maybeSingle();
        if (!call) return Response.json({ error: "Call not found." }, { status: 404 });
        if (!call.recording_url) {
          return Response.json({ error: "Bu qo'ng'iroqda ovoz yozuvi yo'q." }, { status: 400 });
        }

        const { data: agent } = await supabaseAdmin
          .from("ai_agents")
          .select("system_prompt, active")
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
          const summary = await summarizeTranscript(transcript, systemPrompt);

          await supabaseAdmin
            .from("amocrm_calls")
            .update({ transcript, ai_summary: summary, analyzed_at: new Date().toISOString() })
            .eq("id", call.id);

          return Response.json({ transcript, summary });
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
