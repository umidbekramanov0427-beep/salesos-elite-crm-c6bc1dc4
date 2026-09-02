// Called on a schedule (see the accompanying pg_cron migration, 21:00
// Tashkent daily) -- same shared-secret pattern as
// audio-analytics.analyze-pending.ts. For every org that has configured at
// least one fine type with a default_amount, looks at that day's analyzed
// AmoCRM calls per rep and asks the AI which configured fine types the
// evidence in those calls clearly supports. The AI only ever decides
// *whether* a fine type applies -- the amount charged is always the type's
// own admin-configured default_amount, never a number the model invents.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function tashkentTodayBounds(): { dateStr: string; startIso: string; endIso: string } {
  const now = new Date();
  const tashkentNow = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  const dateStr = tashkentNow.toISOString().slice(0, 10);
  const start = new Date(`${dateStr}T00:00:00+05:00`);
  const end = new Date(`${dateStr}T23:59:59+05:00`);
  return { dateStr, startIso: start.toISOString(), endIso: end.toISOString() };
}

type CallDigestRow = {
  id: string;
  ai_summary: string | null;
  score: number | null;
  mood: string | null;
  analysis: unknown;
  leads: { owner_id: string | null } | null;
};

type FineTypeForPrompt = { id: string; name: string; description: string | null };
type ProposedFine = { profile_n: number; fine_type_n: number; reason: string };

async function askAiForFines(
  fineTypes: FineTypeForPrompt[],
  roster: { n: number; profileId: string; name: string; digest: string }[],
): Promise<ProposedFine[]> {
  const apiKey = requireEnv("GEMINI_API_KEY");
  const typesBlock = fineTypes
    .map((t, i) => `${i + 1}. ${t.name}${t.description ? ` — ${t.description}` : ""}`)
    .join("\n");
  const rosterBlock = roster.map((r) => `Sotuvchi ${r.n} (${r.name}):\n${r.digest}`).join("\n\n");

  const systemPrompt = `Siz sotuv bo'limi nazoratchisisiz. Quyida jarima turlari ro'yxati va har bir sotuvchining bugungi qo'ng'iroqlari tahlili berilgan. Faqat aniq va shubhasiz dalil bo'lgan hollardagina jarima tayinlang — gumon yoki noaniq holatlarda hech narsa yozmang. Har bir taklif uchun aniq sababni ko'rsating.

Jarima turlari:
${typesBlock}

Faqat quyidagi JSON formatida javob bering: {"fines": [{"profile_n": <raqam>, "fine_type_n": <raqam>, "reason": "<qisqa asos>"}]}. Agar hech qanday jarima asoslanmagan bo'lsa, {"fines": []} qaytaring.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: rosterBlock }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini error (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const content = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "{}";
  try {
    const parsed = JSON.parse(content) as { fines?: Partial<ProposedFine>[] };
    return (parsed.fines ?? []).filter(
      (f): f is ProposedFine =>
        typeof f.profile_n === "number" && typeof f.fine_type_n === "number",
    );
  } catch {
    return [];
  }
}

function buildDigest(calls: CallDigestRow[]): string {
  return calls
    .map((c, i) => {
      const analysis = (c.analysis ?? {}) as {
        warnings?: string[];
        risks?: string[];
        serviceStandards?: { name: string; violated: boolean; evidence: string }[];
      };
      const violations = (analysis.serviceStandards ?? [])
        .filter((s) => s.violated)
        .map((s) => `${s.name} (${s.evidence})`);
      const lines = [
        `Qo'ng'iroq ${i + 1}${c.score != null ? `, ball: ${c.score}` : ""}${c.mood ? `, kayfiyat: ${c.mood}` : ""}`,
        c.ai_summary ? `Xulosa: ${c.ai_summary}` : null,
        (analysis.warnings ?? []).length
          ? `Ogohlantirishlar: ${analysis.warnings!.join("; ")}`
          : null,
        (analysis.risks ?? []).length ? `Xavflar: ${analysis.risks!.join("; ")}` : null,
        violations.length ? `Standart buzilishlari: ${violations.join("; ")}` : null,
      ].filter(Boolean);
      return lines.join("\n");
    })
    .join("\n\n");
}

export const Route = createFileRoute("/fines/compute")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["CRON_SECRET"];
        const got = request.headers.get("x-cron-secret");
        if (!expected || got !== expected) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { dateStr, startIso, endIso } = tashkentTodayBounds();

        const { data: fineTypeOrgs } = await supabaseAdmin
          .from("fine_types")
          .select("organization_id")
          .not("default_amount", "is", null);
        const organizationIds = [...new Set((fineTypeOrgs ?? []).map((r) => r.organization_id))];

        let orgsProcessed = 0;
        let finesCreated = 0;

        for (const organizationId of organizationIds) {
          try {
            const { data: fineTypes } = await supabaseAdmin
              .from("fine_types")
              .select("id, name, description, default_amount")
              .eq("organization_id", organizationId)
              .not("default_amount", "is", null);
            if (!fineTypes || fineTypes.length === 0) continue;

            const { data: calls } = await supabaseAdmin
              .from("amocrm_calls")
              .select("id, ai_summary, score, mood, analysis, leads:lead_id(owner_id)")
              .eq("organization_id", organizationId)
              .not("analyzed_at", "is", null)
              .gte("occurred_at", startIso)
              .lte("occurred_at", endIso)
              .returns<CallDigestRow[]>();
            if (!calls || calls.length === 0) continue;

            const byProfile = new Map<string, CallDigestRow[]>();
            for (const c of calls) {
              const ownerId = c.leads?.owner_id;
              if (!ownerId) continue;
              byProfile.set(ownerId, [...(byProfile.get(ownerId) ?? []), c]);
            }
            if (byProfile.size === 0) continue;

            const { data: profiles } = await supabaseAdmin
              .from("profiles")
              .select("id, full_name, email")
              .in("id", [...byProfile.keys()]);
            const profileName = new Map(
              (profiles ?? []).map((p) => [p.id, p.full_name || p.email || "—"]),
            );

            const roster = [...byProfile.entries()].map(([profileId, calls], i) => ({
              n: i + 1,
              profileId,
              name: profileName.get(profileId) ?? "—",
              digest: buildDigest(calls),
            }));

            const proposals = await askAiForFines(fineTypes, roster);
            orgsProcessed++;

            for (const p of proposals) {
              const rep = roster.find((r) => r.n === p.profile_n);
              const fineType = fineTypes[p.fine_type_n - 1];
              if (!rep || !fineType || fineType.default_amount == null) continue;

              const { data: existing } = await supabaseAdmin
                .from("fines")
                .select("id")
                .eq("organization_id", organizationId)
                .eq("profile_id", rep.profileId)
                .eq("fine_type_id", fineType.id)
                .eq("occurred_on", dateStr)
                .eq("source", "ai")
                .maybeSingle();
              if (existing) continue;

              const { error } = await supabaseAdmin.from("fines").insert({
                organization_id: organizationId,
                profile_id: rep.profileId,
                fine_type_id: fineType.id,
                amount: fineType.default_amount,
                occurred_on: dateStr,
                reason: p.reason || null,
                source: "ai",
              });
              if (!error) finesCreated++;
            }
          } catch (err) {
            console.error(`[fines.compute] org ${organizationId} failed:`, err);
          }
        }

        return Response.json({ orgsProcessed, finesCreated });
      },
    },
  },
});
