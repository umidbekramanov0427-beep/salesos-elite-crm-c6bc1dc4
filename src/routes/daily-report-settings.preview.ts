// Server-only. Builds the real "Hisobot namunasi" preview shown on the
// Kunlik hisobot sozlamalari page: every section is computed from today's
// actual data (or, once report_sample_override is set via "Tahrirlash",
// that saved override text is returned as-is instead). The numeric parts
// are plain SQL aggregates; the narrative parts (manager strengths/watch-
// outs, "eng ko'p uchragan mazmun" per anketa savoli, Tavsiyalar, Xulosa)
// come from one Gemini call fed the aggregates + a sample of today's raw
// call analysis / intake answers, per the user's explicit choice to use a
// real AI call here rather than rule-based text.
import { createFileRoute } from "@tanstack/react-router";
import { getRequestUserId } from "@/lib/auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function dayBounds(daysAgo: number): { start: string; end: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - daysAgo);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function fmtDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  if (h === 0) return `${m} daqiqa`;
  return `${h} soat ${m} daqiqa`;
}

function fmtPct(part: number, total: number): string {
  if (total === 0) return "0.0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

function scopeIds(configured: string[] | null | undefined, allIds: string[]): Set<string> {
  return new Set(configured == null ? allIds : configured);
}

type NarrativeResult = {
  managers: { n: number; strengths: string[]; attention: string[] }[];
  intakeSummaries: { n: number; count: number; summary: string }[];
  recommendations: string[];
  summary: string;
};

async function generateNarrative(input: {
  statsBlock: string;
  managers: { n: number; name: string; strengthsRaw: string[]; improvementsRaw: string[] }[];
  intakeQuestions: { n: number; label: string; answers: string[] }[];
}): Promise<NarrativeResult> {
  const apiKey = process.env["GEMINI_API_KEY"];
  const empty: NarrativeResult = {
    managers: [],
    intakeSummaries: [],
    recommendations: [],
    summary: "",
  };
  if (!apiKey) return empty;
  if (
    input.managers.length === 0 &&
    input.intakeQuestions.length === 0 &&
    !input.statsBlock.trim()
  ) {
    return empty;
  }

  const managerBlock = input.managers
    .map(
      (m) =>
        `Menejer ${m.n} (${m.name}):\nKuchli tomonlar (xom): ${m.strengthsRaw.slice(0, 15).join("; ") || "yo'q"}\nYaxshilash kerak (xom): ${m.improvementsRaw.slice(0, 15).join("; ") || "yo'q"}`,
    )
    .join("\n\n");
  const questionBlock = input.intakeQuestions
    .map(
      (q) =>
        `Savol ${q.n} (${q.label}) — ${q.answers.length} ta javob:\n` +
        q.answers
          .slice(0, 20)
          .map((a) => `- ${a}`)
          .join("\n"),
    )
    .join("\n\n");

  const prompt =
    "Siz sotuv bo'limi rahbari uchun kunlik hisobot yozuvchisisiz. Quyidagi bugungi statistika va xom ma'lumotlar asosida FAQAT quyidagi JSON formatida javob ber, boshqa hech qanday matn yozma:\n" +
    '{"managers": [{"n": <menejer raqami>, "strengths": ["qisqa band", ...max 3], "attention": ["qisqa band", ...max 3]}, ...], ' +
    '"intake_summaries": [{"n": <savol raqami>, "count": <shu mazmunga mos javoblar soni>, "summary": "eng ko\'p uchragan javob mazmuni, 1 jumla"}, ...], ' +
    '"recommendations": ["ertangi kun uchun aniq harakat", ... 3 ta], ' +
    '"summary": "hisobot uchun 1-2 jumlali yakuniy xulosa"}\n\n' +
    "Bugungi statistika:\n" +
    input.statsBlock +
    (managerBlock ? "\n\nMenejerlar bo'yicha xom ma'lumot:\n" + managerBlock : "") +
    (questionBlock ? "\n\nAnketa savollari bo'yicha xom javoblar:\n" + questionBlock : "");

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
          }),
          signal: controller.signal,
        },
      );
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return empty;
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const content = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    const parsed = JSON.parse(content) as {
      managers?: { n?: number; strengths?: string[]; attention?: string[] }[];
      intake_summaries?: { n?: number; count?: number; summary?: string }[];
      recommendations?: string[];
      summary?: string;
    };
    return {
      managers: Array.isArray(parsed.managers)
        ? parsed.managers
            .filter(
              (m): m is { n: number; strengths?: string[]; attention?: string[] } =>
                typeof m.n === "number",
            )
            .map((m) => ({
              n: m.n,
              strengths: (m.strengths ?? []).filter((s) => typeof s === "string"),
              attention: (m.attention ?? []).filter((s) => typeof s === "string"),
            }))
        : [],
      intakeSummaries: Array.isArray(parsed.intake_summaries)
        ? parsed.intake_summaries
            .filter(
              (q): q is { n: number; count?: number; summary?: string } => typeof q.n === "number",
            )
            .map((q) => ({ n: q.n, count: Number(q.count) || 0, summary: q.summary ?? "" }))
        : [],
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations.filter((r) => typeof r === "string")
        : [],
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
    };
  } catch {
    return empty;
  }
}

export const Route = createFileRoute("/daily-report-settings/preview")({
  server: {
    handlers: {
      GET: async ({ request }) => {
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

        const { data: settings } = await supabaseAdmin
          .from("daily_report_settings")
          .select("*")
          .eq("organization_id", organizationId)
          .maybeSingle();

        if (settings?.report_sample_override) {
          return Response.json({ text: settings.report_sample_override, override: true });
        }

        const today = dayBounds(0);
        const yesterday = dayBounds(1);

        const [
          profilesRes,
          callsTodayRes,
          callsYesterdayRes,
          tasksRes,
          leadsTodayRes,
          stagesRes,
          leadQualityStagesRes,
          serviceLinesRes,
          intakeQuestionsRes,
        ] = await Promise.all([
          supabaseAdmin
            .from("profiles")
            .select("id, full_name, email, role")
            .eq("organization_id", organizationId),
          supabaseAdmin
            .from("amocrm_calls")
            .select(
              "id, lead_id, connected, duration_seconds, recording_url, analyzed_at, score, service_line_id, intake_answers, analysis",
            )
            .eq("organization_id", organizationId)
            .gte("occurred_at", today.start)
            .lt("occurred_at", today.end),
          supabaseAdmin
            .from("amocrm_calls")
            .select("id, connected")
            .eq("organization_id", organizationId)
            .gte("occurred_at", yesterday.start)
            .lt("occurred_at", yesterday.end),
          supabaseAdmin
            .from("tasks")
            .select("id, status, assignee_id, due_date, updated_at")
            .eq("organization_id", organizationId),
          supabaseAdmin
            .from("leads")
            .select(
              "id, owner_id, funnel, stage_id, expected_revenue, created_at, updated_at, lead_quality_stage_id",
            )
            .eq("organization_id", organizationId),
          supabaseAdmin
            .from("pipeline_stages")
            .select("id, is_won, is_lost")
            .eq("organization_id", organizationId),
          supabaseAdmin
            .from("lead_quality_stages")
            .select("id, title, qualified")
            .eq("organization_id", organizationId)
            .order("position", { ascending: true }),
          supabaseAdmin
            .from("service_lines")
            .select("id, name")
            .eq("organization_id", organizationId)
            .order("position", { ascending: true }),
          supabaseAdmin
            .from("intake_questions")
            .select("id, label")
            .eq("organization_id", organizationId)
            .order("position", { ascending: true }),
        ]);

        const profiles = profilesRes.data ?? [];
        const callsToday = callsTodayRes.data ?? [];
        const callsYesterday = callsYesterdayRes.data ?? [];
        const tasks = tasksRes.data ?? [];
        const allLeads = leadsTodayRes.data ?? [];
        const stages = stagesRes.data ?? [];
        const leadQualityStages = leadQualityStagesRes.data ?? [];
        const serviceLines = serviceLinesRes.data ?? [];
        const intakeQuestions = intakeQuestionsRes.data ?? [];

        const managers = profiles.filter((p) => p.role === "sotuv_menejeri");
        const leadOwnerById = new Map(allLeads.map((l) => [l.id, l.owner_id]));
        const leadsCreatedToday = allLeads.filter((l) => l.created_at >= today.start);
        const wonStageIds = new Set(stages.filter((s) => s.is_won).map((s) => s.id));
        const lostStageIds = new Set(stages.filter((s) => s.is_lost).map((s) => s.id));

        const sections: string[] = [];
        const s = settings;

        // --- CRM faolligi ---
        if (s?.crm_activity_enabled ?? true) {
          const total = callsToday.length;
          const connected = callsToday.filter((c) => c.connected).length;
          const totalSeconds = callsToday.reduce((sum, c) => sum + c.duration_seconds, 0);
          const yTotal = callsYesterday.length;
          const yConnected = callsYesterday.filter((c) => c.connected).length;
          sections.push(
            [
              "CRM faolligi",
              `- Jami qo'ng'iroqlar: ${total}`,
              `- Bog'langan qo'ng'iroqlar: ${connected}`,
              `- Mijozga yetib borilmagan qo'ng'iroqlar: ${total - connected}`,
              `- Bog'lanish darajasi: ${fmtPct(connected, total)}`,
              `- Umumiy suhbat vaqti: ${fmtDuration(totalSeconds)}`,
              `- Oldingi ish kuni: jami qo'ng'iroqlar ${yTotal}, bog'langan qo'ng'iroqlar ${yConnected}, bog'lanish darajasi ${fmtPct(yConnected, yTotal)}`,
            ].join("\n"),
          );
        }

        // --- Vazifalar rejasi ---
        const managerScope = scopeIds(
          s?.managers_activity_manager_ids,
          managers.map((m) => m.id),
        );
        if (s?.tasks_plan_enabled ?? true) {
          const dueToday = tasks.filter(
            (t) => t.due_date && t.due_date >= today.start && t.due_date < today.end,
          );
          const doneOfDue = dueToday.filter((t) => t.status === "Done");
          const doneToday = tasks.filter(
            (t) => t.status === "Done" && t.updated_at >= today.start && t.updated_at < today.end,
          );
          const perManager = managers
            .filter((m) => managerScope.has(m.id))
            .map((m) => {
              const mine = dueToday.filter((t) => t.assignee_id === m.id);
              const mineDone = mine.filter((t) => t.status === "Done");
              return `- ${m.full_name || m.email}: ${mineDone.length} / ${mine.length}, qoldi ${mine.length - mineDone.length}, jami ${mine.length}`;
            });
          sections.push(
            [
              "Vazifalar rejasi",
              `- Bugungi reja vazifalaridan bajarilgani: ${doneOfDue.length} / ${dueToday.length}`,
              `- Bugungi reja vazifalaridan qolgani: ${dueToday.length - doneOfDue.length}`,
              `- Bugun yakunlangan vazifalar: ${doneToday.length}`,
              ...(perManager.length > 0
                ? ["", "Menejerlar bo'yicha (bajarildi/reja, qoldi, jami):", ...perManager]
                : []),
            ].join("\n"),
          );
        }

        // --- Qo'ng'iroqlar sifati ---
        if (s?.call_quality_enabled ?? true) {
          const analyzed = callsToday.filter((c) => c.analyzed_at);
          const withChecklist = analyzed.filter((c) => {
            const a = c.analysis as { checklist?: unknown[] } | null;
            return Array.isArray(a?.checklist) && a.checklist.length > 0;
          });
          const operational = analyzed.length - withChecklist.length;
          const unconnected = callsToday.filter((c) => !c.connected).length;
          const scores = analyzed.map((c) => c.score).filter((n): n is number => n != null);
          const avgScore =
            scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
          const noAudio = callsToday.filter((c) => !c.recording_url).length;
          sections.push(
            [
              "Qo'ng'iroqlar sifati",
              `- Tahlil qilingan qo'ng'iroqlar: ${analyzed.length}`,
              `- Savdo ssenariysi asosidagi qo'ng'iroqlar: ${withChecklist.length} (${fmtPct(withChecklist.length, analyzed.length)})`,
              `- Operatsion yoki chiqarilgan qo'ng'iroqlar: ${operational}`,
              `- Bog'lanilmagan holatlar: ${unconnected}`,
              `- O'rtacha ball: ${avgScore.toFixed(1)}`,
              `- Material audio muammolari: no_audio: ${noAudio}`,
            ].join("\n"),
          );
        }

        // --- Menejerlar faoliyati (+ AI narrative) ---
        const scopedManagers = managers.filter((m) => managerScope.has(m.id));
        const managerStats = scopedManagers.map((m, i) => {
          const mine = callsToday.filter((c) => leadOwnerById.get(c.lead_id ?? "") === m.id);
          const connected = mine.filter((c) => c.connected).length;
          const seconds = mine.reduce((sum, c) => sum + c.duration_seconds, 0);
          const scores = mine.map((c) => c.score).filter((n): n is number => n != null);
          const avgScore =
            scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
          const strengthsRaw: string[] = [];
          const improvementsRaw: string[] = [];
          for (const c of mine) {
            const a = c.analysis as { strengths?: string[]; improvements?: string[] } | null;
            strengthsRaw.push(...(a?.strengths ?? []));
            improvementsRaw.push(...(a?.improvements ?? []));
          }
          return {
            n: i + 1,
            manager: m,
            total: mine.length,
            connected,
            seconds,
            avgScore,
            strengthsRaw,
            improvementsRaw,
          };
        });

        // --- Lidlar harakati ---
        const funnelScope = scopeIds(
          s?.leads_movement_funnels,
          Array.from(new Set(allLeads.map((l) => l.funnel).filter((f): f is string => !!f))),
        );
        const leadsInScope = leadsCreatedToday.filter((l) => l.funnel && funnelScope.has(l.funnel));
        let leadsMovementText = "";
        if (s?.leads_movement_enabled ?? true) {
          const wonToday = allLeads.filter(
            (l) =>
              l.funnel &&
              funnelScope.has(l.funnel) &&
              l.stage_id &&
              wonStageIds.has(l.stage_id) &&
              l.updated_at >= today.start,
          );
          const lostToday = allLeads.filter(
            (l) =>
              l.funnel &&
              funnelScope.has(l.funnel) &&
              l.stage_id &&
              lostStageIds.has(l.stage_id) &&
              l.updated_at >= today.start,
          );
          const wonRevenue = wonToday.reduce((sum, l) => sum + Number(l.expected_revenue), 0);
          const includedFunnels = Array.from(funnelScope);
          leadsMovementText = [
            "Lidlar harakati",
            `- Yangi lidlar: ${leadsInScope.length}`,
            `- Yutilgan bitimlar: ${wonToday.length}`,
            `- Yo'qotilgan lidlar: ${lostToday.length}`,
            `- Yutilgan qiymat: ${wonRevenue.toLocaleString("en-US")}`,
            `- Kiritilgan voronkalar: ${includedFunnels.join(", ")}`,
            `Bugun tizimga ${leadsInScope.length} ta yangi lid qo'shildi va ${wonToday.length} ta muvaffaqiyatli kelishuv qayd etildi.`,
          ].join("\n");
          sections.push(leadsMovementText);
        }

        // --- Lid sifati ---
        const qualityScope = scopeIds(
          s?.lead_quality_stage_ids,
          leadQualityStages.map((q) => q.id),
        );
        if (s?.lead_quality_enabled ?? true) {
          const worked = leadsCreatedToday.filter((l) =>
            callsToday.some((c) => c.lead_id === l.id),
          );
          const unreachable = leadsCreatedToday.filter(
            (l) => !callsToday.some((c) => c.lead_id === l.id),
          );
          const qualified = leadsCreatedToday.filter((l) => {
            const stage = leadQualityStages.find((q) => q.id === l.lead_quality_stage_id);
            return stage?.qualified === true;
          });
          const unqualified = leadsCreatedToday.filter((l) => {
            const stage = leadQualityStages.find((q) => q.id === l.lead_quality_stage_id);
            return stage != null && stage.qualified === false;
          });
          const groupLines = leadQualityStages
            .filter((q) => qualityScope.has(q.id))
            .map((q) => {
              const count = leadsCreatedToday.filter(
                (l) => l.lead_quality_stage_id === q.id,
              ).length;
              return `- ${q.title}: ${count}`;
            });
          sections.push(
            [
              "Lid sifati",
              `- Jami yangi lidlar: ${leadsCreatedToday.length}`,
              `- Ishlangan lidlar: ${worked.length}`,
              `- Sifatli: ${qualified.length}`,
              `- Sifatsiz: ${unqualified.length}`,
              `- Bog'lana olinmagan: ${unreachable.length}`,
              ...(groupLines.length > 0 ? ["Guruhlar:", ...groupLines] : []),
            ].join("\n"),
          );
        }

        // --- Xizmat yo'nalishlari ---
        if (s?.service_lines_enabled ?? true) {
          const lines = serviceLines.map((line) => {
            const count = callsToday.filter((c) => c.service_line_id === line.id).length;
            return `- ${line.name}: ${count}`;
          });
          sections.push(
            [
              "Xizmat yo'nalishlari",
              ...lines,
              "Muloqotlarning asosiy qismi sozlangan shu sotuv yo'nalishlariga to'g'ri kelgani ko'rsatiladi.",
            ].join("\n"),
          );
        }

        // --- Anketa savollari ---
        const questionScope = scopeIds(
          s?.intake_question_ids,
          intakeQuestions.map((q) => q.id),
        );
        const scopedQuestions = intakeQuestions
          .filter((q) => questionScope.has(q.id))
          .map((q, i) => {
            const answers = callsToday
              .map((c) => {
                const raw = c.intake_answers as Record<string, string> | null;
                return raw?.[q.id]?.trim() ?? "";
              })
              .filter((a) => a !== "");
            return { n: i + 1, id: q.id, label: q.label, answers };
          });

        // --- Menejerlar faoliyati / Anketa savollari narrative ---
        const narrative = await generateNarrative({
          statsBlock: sections.join("\n\n"),
          managers: managerStats.map((m) => ({
            n: m.n,
            name: m.manager.full_name || m.manager.email,
            strengthsRaw: m.strengthsRaw,
            improvementsRaw: m.improvementsRaw,
          })),
          intakeQuestions: scopedQuestions.map((q) => ({
            n: q.n,
            label: q.label,
            answers: q.answers,
          })),
        });

        if (s?.managers_activity_enabled ?? true) {
          const narrativeByN = new Map(narrative.managers.map((m) => [m.n, m]));
          const managerLines = managerStats.map((m) => {
            const nar = narrativeByN.get(m.n);
            const lines = [
              `${m.manager.full_name || m.manager.email}`,
              `- Ko'rsatkichlar: Jami qo'ng'iroqlar: ${m.total}; Bog'langan qo'ng'iroqlar: ${m.connected}; Bog'lanish darajasi: ${fmtPct(m.connected, m.total)}; Umumiy suhbat vaqti: ${fmtDuration(m.seconds)}; O'rtacha ball: ${m.avgScore.toFixed(1)}`,
            ];
            if (nar?.strengths.length) lines.push(`- Kuchli tomonlar: ${nar.strengths.join("; ")}`);
            if (nar?.attention.length)
              lines.push(`- E'tibor kerak bo'lgan jihatlar: ${nar.attention.join("; ")}`);
            return lines.join("\n");
          });
          sections.splice(
            sections.findIndex((sec) => sec.startsWith("Lidlar harakati")) === -1
              ? sections.length
              : sections.findIndex((sec) => sec.startsWith("Lidlar harakati")),
            0,
            ["Menejerlar faoliyati", ...managerLines].join("\n\n"),
          );
        }

        if (scopedQuestions.length > 0 && (s?.intake_questions_enabled ?? true)) {
          const narrativeByN = new Map(narrative.intakeSummaries.map((q) => [q.n, q]));
          const lines = scopedQuestions.map((q) => {
            const nar = narrativeByN.get(q.n);
            const header = `- ${q.label}`;
            const body = nar?.summary
              ? `Bugungi holat: ${q.answers.length} ta javobdan eng ko'p uchragan mazmun: ${nar.summary} (${nar.count} ta suhbat).`
              : `Bugungi holat: ${q.answers.length} ta javob olindi.`;
            return `${header}\n${body}`;
          });
          sections.push(["Anketa savollari", ...lines].join("\n"));
        }

        if (s?.recommendations_enabled ?? true) {
          const recs =
            narrative.recommendations.length > 0
              ? narrative.recommendations
              : ["Hozircha tavsiya generatsiya qilinmadi."];
          sections.push(["Tavsiyalar", ...recs.map((r, i) => `${i + 1}. ${r}`)].join("\n"));
        }

        if (s?.summary_enabled ?? true) {
          sections.push(
            ["Xulosa", narrative.summary || "Hozircha xulosa generatsiya qilinmadi."].join("\n"),
          );
        }

        return Response.json({ text: sections.join("\n\n"), override: false });
      },
    },
  },
});
