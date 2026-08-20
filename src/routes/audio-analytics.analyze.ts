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
// structured scoring) — matching the provider the rest of the platform's AI
// features (ai-assistant.chat.ts) already use.
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

type RubricStep = {
  n: number;
  stage: string;
  step: string;
  skill: string | null;
  points: number;
};

// A fixed baseline set of conduct rules every call is checked against,
// separate from the org's own configurable stage/step rubric above -- these
// don't vary funnel to funnel or org to org the way sales technique does,
// so they aren't backed by a settings table like call_stages is.
const SERVICE_STANDARDS = [
  "Vakolatdan tashqari va'da bermaslik",
  "Mijozni bo'lmaslik",
  "Mijozga ismi bilan murojaat qilish",
  "Hurmatli va xushmuomala ohang",
  "Mijoz bilan bahslashmaslik",
];

async function loadRubric(organizationId: string): Promise<RubricStep[]> {
  const { data: stages } = await supabaseAdmin
    .from("call_stages")
    .select("id, name, position")
    .eq("organization_id", organizationId)
    .order("position", { ascending: true });
  if (!stages || stages.length === 0) return [];

  const { data: steps } = await supabaseAdmin
    .from("call_stage_steps")
    .select("stage_id, name, skill_id, points, position")
    .eq("organization_id", organizationId)
    .order("position", { ascending: true });

  const { data: skills } = await supabaseAdmin
    .from("call_skills")
    .select("id, name")
    .eq("organization_id", organizationId);
  const skillNameById = new Map((skills ?? []).map((s) => [s.id, s.name]));

  const rubric: RubricStep[] = [];
  let n = 1;
  for (const stage of stages) {
    const stageSteps = (steps ?? []).filter((s) => s.stage_id === stage.id);
    for (const step of stageSteps) {
      rubric.push({
        n: n++,
        stage: stage.name,
        step: step.name,
        skill: step.skill_id ? (skillNameById.get(step.skill_id) ?? null) : null,
        points: Number(step.points) || 0,
      });
    }
  }
  return rubric;
}

function buildJsonInstruction(rubric: RubricStep[]): string {
  const base =
    '{"summary": "qo\'ng\'iroq mavzusi va mijoz kayfiyati haqida qisqa xulosa", ' +
    '"next_step": "menejer keyin aniq nima qilishi kerak — bitta lo\'nda jumla", ' +
    '"mood": "mijozning umumiy kayfiyati — bir-ikki so\'z (masalan: qiziqgan, betaraf, norozi)", ' +
    '"talk_ratio": "menejerning gapirish vaqti foizda taxminiy baho, 0 dan 100 gacha butun son", ' +
    '"strengths": ["menejer yaxshi qilgan narsalar ro\'yxati"], ' +
    '"improvements": ["yaxshilash kerak bo\'lgan narsalar ro\'yxati"], ' +
    "\"warnings\": [\"ogohlantirishga arziydigan holatlar ro'yxati, bo'lmasa bo'sh ro'yxat\"], " +
    "\"risks\": [\"bitim yo'qolish xavfi bilan bog'liq holatlar, bo'lmasa bo'sh ro'yxat\"], " +
    '"agreements": ["tomonlar kelishib olgan narsalar, bo\'lmasa bo\'sh ro\'yxat"], ' +
    '"key_quotes": ["suhbatdan 2-4 ta muhim, so\'zma-so\'z iqtibos"], ' +
    "\"top_objections\": [\"mijoz bildirgan e'tirozlar, bo'lmasa bo'sh ro'yxat\"], " +
    '"service_standards": [{"n": 1, "violated": false, "evidence": "buzilgan bo\'lsa qisqa dalil/iqtibos, aks holda bo\'sh matn"}, ...]';

  const standardsLines = SERVICE_STANDARDS.map((s, i) => `${i + 1}. ${s}`).join("\n");
  const standardsInstruction =
    "\n\nQuyidagi xizmat standartlari ro'yxatini ham tekshir — har biri buzilganmi yoki yo'qmi (violated: true/false) va buzilgan bo'lsa qisqa dalil (evidence):\n" +
    standardsLines +
    '\n\n"service_standards" massivida yuqoridagi RO\'YXATDAGI HAR BIR band uchun aynan bitta yozuv bo\'lishi kerak, "n" band raqamiga mos kelishi kerak.';

  if (rubric.length === 0) {
    return (
      standardsInstruction +
      "\n\nJavobni faqat quyidagi JSON formatida qaytar, boshqa hech qanday matn yozma:\n{" +
      base.slice(1) +
      ', "score": "qo\'ng\'iroqqa umumiy baho, 0 dan 100 gacha butun son"}'
    );
  }

  const checklistLines = rubric
    .map((r) => `${r.n}. [${r.stage}] ${r.step}${r.skill ? ` (ko'nikma: ${r.skill})` : ""}`)
    .join("\n");

  return (
    standardsInstruction +
    "\n\nQuyidagi tekshiruv ro'yxati (checklist) asosida qo'ng'iroqni bahola. Har bir band uchun menejer buni bajarganmi yoki yo'qmi (met: true/false) va qisqa izoh (note) ber:\n" +
    checklistLines +
    "\n\nJavobni faqat quyidagi JSON formatida qaytar, boshqa hech qanday matn yozma:\n{" +
    base.slice(1) +
    ', "checklist": [{"n": 1, "met": true, "note": "qisqa izoh"}, ...] — checklist massivida yuqoridagi RO\'YXATDAGI HAR BIR band uchun aynan bitta yozuv bo\'lishi kerak, "n" band raqamiga mos kelishi kerak}'
  );
}

async function analyzeTranscript(
  transcript: string,
  systemPrompt: string,
  rubric: RubricStep[],
): Promise<{
  summary: string;
  nextStep: string | null;
  mood: string | null;
  talkRatio: number | null;
  score: number | null;
  checklist: { n: number; met: boolean; note: string }[];
  strengths: string[];
  improvements: string[];
  warnings: string[];
  risks: string[];
  agreements: string[];
  keyQuotes: string[];
  topObjections: string[];
  serviceStandards: { n: number; violated: boolean; evidence: string }[];
}> {
  const apiKey = requireEnv("GEMINI_API_KEY");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt + buildJsonInstruction(rubric) }] },
        contents: [{ role: "user", parts: [{ text: transcript }] }],
        generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini error (${res.status}): ${text}`);
  }
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const content = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

  const asStringArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];

  try {
    const parsed = JSON.parse(content) as {
      summary?: string;
      next_step?: string;
      mood?: string;
      talk_ratio?: number | string;
      score?: number | string;
      checklist?: { n?: number; met?: boolean; note?: string }[];
      strengths?: string[];
      improvements?: string[];
      warnings?: string[];
      risks?: string[];
      agreements?: string[];
      key_quotes?: string[];
      top_objections?: string[];
      service_standards?: { n?: number; violated?: boolean; evidence?: string }[];
    };
    if (!parsed.summary) throw new Error("no summary");

    const talkRatioNum = Number(parsed.talk_ratio);
    const scoreNum = Number(parsed.score);

    return {
      summary: parsed.summary.trim(),
      nextStep: parsed.next_step?.trim() || null,
      mood: parsed.mood?.trim() || null,
      talkRatio: Number.isFinite(talkRatioNum)
        ? Math.min(100, Math.max(0, Math.round(talkRatioNum)))
        : null,
      score: Number.isFinite(scoreNum) ? Math.min(100, Math.max(0, Math.round(scoreNum))) : null,
      checklist: Array.isArray(parsed.checklist)
        ? parsed.checklist.filter(
            (c): c is { n: number; met: boolean; note: string } =>
              typeof c.n === "number" && typeof c.met === "boolean",
          )
        : [],
      strengths: asStringArray(parsed.strengths),
      improvements: asStringArray(parsed.improvements),
      warnings: asStringArray(parsed.warnings),
      risks: asStringArray(parsed.risks),
      agreements: asStringArray(parsed.agreements),
      keyQuotes: asStringArray(parsed.key_quotes),
      topObjections: asStringArray(parsed.top_objections),
      serviceStandards: Array.isArray(parsed.service_standards)
        ? parsed.service_standards.filter(
            (s): s is { n: number; violated: boolean; evidence: string } =>
              typeof s.n === "number" && typeof s.violated === "boolean",
          )
        : [],
    };
  } catch {
    // Model didn't return valid JSON (can happen with a heavily customized
    // agent prompt) — fall back to treating the raw text as the summary and
    // leaving every structured field empty rather than failing the whole
    // analysis outright.
    return {
      summary: content,
      nextStep: null,
      mood: null,
      talkRatio: null,
      score: null,
      checklist: [],
      strengths: [],
      improvements: [],
      warnings: [],
      risks: [],
      agreements: [],
      keyQuotes: [],
      topObjections: [],
      serviceStandards: [],
    };
  }
}

// AmoCRM has no real "lead temperature" concept -- this is the only place a
// lead's score/temperature ever gets set to something other than the
// column defaults (score=50, temperature='Warm'), rolling up whatever the
// AI call-analysis engine just found for its most recent call.
function temperatureFromScore(score: number): "Cold" | "Warm" | "Hot" | "VeryHot" {
  if (score >= 76) return "VeryHot";
  if (score >= 51) return "Hot";
  if (score >= 26) return "Warm";
  return "Cold";
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
          .select(
            "id, lead_id, recording_url, source, amocrm_task_id, leads:lead_id(amocrm_id, owner_id)",
          )
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
          "Siz qo'ng'iroq yozuvini tahlil qiluvchi tajribali sotuv nazoratchisisiz. Asosiy mavzuni, mijoz kayfiyatini, menejerning kuchli va zaif tomonlarini xolisona baholang.";

        try {
          const transcript = await transcribeAudio(call.recording_url);
          if (!transcript) {
            return Response.json(
              { error: "Ovozdan matn chiqmadi (bo'sh yozuv)." },
              { status: 422 },
            );
          }

          const rubric = await loadRubric(organizationId);
          const result = await analyzeTranscript(transcript, systemPrompt, rubric);

          // A configured rubric always wins over the AI's own holistic
          // guess — it's a fixed, auditable formula (matched point-weight /
          // total point-weight) instead of a number the model invented, so
          // the score stays consistent across calls and can't silently
          // drift as the underlying model changes.
          let score = result.score;
          const totalPoints = rubric.reduce((s, r) => s + r.points, 0);
          if (rubric.length > 0 && totalPoints > 0) {
            const metByN = new Map(result.checklist.map((c) => [c.n, c.met]));
            const matchedPoints = rubric.reduce((s, r) => s + (metByN.get(r.n) ? r.points : 0), 0);
            score = Math.round((matchedPoints / totalPoints) * 100);
          }

          const noteByN = new Map(result.checklist.map((c) => [c.n, c.note ?? ""]));
          const metByN = new Map(result.checklist.map((c) => [c.n, c.met]));
          const standardByN = new Map(
            result.serviceStandards.map((s) => [
              s.n,
              { violated: s.violated, evidence: s.evidence ?? "" },
            ]),
          );
          const analysis = {
            checklist: rubric.map((r) => ({
              stage: r.stage,
              step: r.step,
              skill: r.skill,
              points: r.points,
              met: metByN.get(r.n) ?? false,
              note: noteByN.get(r.n) ?? "",
            })),
            strengths: result.strengths,
            improvements: result.improvements,
            warnings: result.warnings,
            risks: result.risks,
            agreements: result.agreements,
            keyQuotes: result.keyQuotes,
            topObjections: result.topObjections,
            serviceStandards: SERVICE_STANDARDS.map((name, i) => ({
              name,
              violated: standardByN.get(i + 1)?.violated ?? false,
              evidence: standardByN.get(i + 1)?.evidence ?? "",
            })),
          };

          await supabaseAdmin
            .from("amocrm_calls")
            .update({
              transcript,
              ai_summary: result.summary,
              next_step: result.nextStep,
              score,
              mood: result.mood,
              talk_ratio: result.talkRatio,
              analysis,
              analyzed_at: new Date().toISOString(),
            })
            .eq("id", call.id);

          if (call.lead_id && score != null) {
            await supabaseAdmin
              .from("leads")
              .update({ score, temperature: temperatureFromScore(score) })
              .eq("id", call.lead_id);
          }

          // Hand the AI-suggested next step to the responsible manager as a
          // reminder inside AmoCRM — best-effort: a failure here shouldn't
          // undo the analysis that's already saved. Skipped for manually
          // uploaded calls (no AmoCRM lead to attach a task to) and never
          // duplicated on re-analysis.
          let taskWarning: string | null = null;
          const leadAmoId = call.leads?.amocrm_id ?? null;
          if (result.nextStep && call.source === "amocrm" && leadAmoId && !call.amocrm_task_id) {
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
                result.nextStep,
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

          return Response.json({
            transcript,
            summary: result.summary,
            nextStep: result.nextStep,
            score,
            mood: result.mood,
            talkRatio: result.talkRatio,
            analysis,
            taskWarning,
          });
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
