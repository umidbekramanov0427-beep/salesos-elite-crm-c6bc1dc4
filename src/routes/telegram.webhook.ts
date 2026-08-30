import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTelegramMessage } from "@/lib/telegram-report.server";

type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: { id?: number; username?: string };
  };
};

const CODE_RE = /[A-Z0-9]{8}/;

// Kadrlar bo'limi: a job-posting link is `t.me/<bot>?start=<token>`, which
// Telegram delivers to the webhook as the literal message text
// "/start <token>" — this bot has no other use for /start, so any match
// here is exclusively an HR application starting, never a link-code paste.
async function startHrApplication(
  chatId: number,
  token: string,
  username: string | undefined,
): Promise<void> {
  const { data: vacancy } = await supabaseAdmin
    .from("hr_vacancies")
    .select("id, organization_id, title, active")
    .eq("telegram_start_token", token)
    .maybeSingle();
  if (!vacancy || !vacancy.active) {
    await sendTelegramMessage(chatId, "Bu vakansiya havolasi topilmadi yoki endi faol emas.").catch(
      () => undefined,
    );
    return;
  }

  const { data: questions } = await supabaseAdmin
    .from("hr_questions")
    .select("id, question, position")
    .eq("organization_id", vacancy.organization_id)
    .order("position", { ascending: true });

  if (!questions || questions.length === 0) {
    await sendTelegramMessage(
      chatId,
      "Hozircha bu vakansiya uchun savollar sozlanmagan. Iltimos, keyinroq qayta urinib ko'ring.",
    ).catch(() => undefined);
    return;
  }

  await supabaseAdmin.from("hr_candidates").insert({
    organization_id: vacancy.organization_id,
    vacancy_id: vacancy.id,
    telegram_chat_id: chatId,
    telegram_username: username ?? null,
    current_question_position: 0,
  });

  await sendTelegramMessage(
    chatId,
    `Assalomu alaykum! "${vacancy.title}" vakansiyasiga murojaatingiz uchun rahmat. Sizga bir nechta savol beramiz.\n\n${questions[0]!.question}`,
  ).catch(() => undefined);
}

// Any incoming text from a chat with an unfinished application is that
// application's next answer — checked before anything else so a candidate's
// free-text answer can never get misread as a link code or onboarding reply.
async function continueHrApplication(chatId: number, answerText: string): Promise<boolean> {
  const { data: candidate } = await supabaseAdmin
    .from("hr_candidates")
    .select("id, organization_id, current_question_position")
    .eq("telegram_chat_id", chatId)
    .is("completed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!candidate) return false;

  const { data: questions } = await supabaseAdmin
    .from("hr_questions")
    .select("id, question, position")
    .eq("organization_id", candidate.organization_id)
    .order("position", { ascending: true });
  const currentQuestion = questions?.[candidate.current_question_position];
  if (!currentQuestion) return false;

  await supabaseAdmin.from("hr_candidate_answers").upsert(
    {
      organization_id: candidate.organization_id,
      candidate_id: candidate.id,
      question_id: currentQuestion.id,
      answer_text: answerText.trim(),
    },
    { onConflict: "candidate_id,question_id" },
  );

  const nextPosition = candidate.current_question_position + 1;
  const nextQuestion = questions![nextPosition];
  if (nextQuestion) {
    await supabaseAdmin
      .from("hr_candidates")
      .update({ current_question_position: nextPosition, updated_at: new Date().toISOString() })
      .eq("id", candidate.id);
    await sendTelegramMessage(chatId, nextQuestion.question).catch(() => undefined);
    return true;
  }

  await supabaseAdmin
    .from("hr_candidates")
    .update({ completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", candidate.id);

  const { data: settings } = await supabaseAdmin
    .from("hr_settings")
    .select("academy_channel_invite_link")
    .eq("organization_id", candidate.organization_id)
    .maybeSingle();

  const closingText = settings?.academy_channel_invite_link
    ? `Rahmat! Barcha savollarga javob berdingiz. Endi <a href="${settings.academy_channel_invite_link}">TOP kadrlar akademiyasi</a> kanaliga qo'shiling — u yerda keyingi bosqichlar haqida ma'lumot olasiz.`
    : "Rahmat! Barcha savollarga javob berdingiz. Tez orada siz bilan bog'lanamiz.";
  await sendTelegramMessage(chatId, closingText).catch(() => undefined);
  return true;
}

// Asks the same 5 fields the in-app "AI bot bilan to'ldirish" widget does,
// one per message — since each answer maps to exactly one field, this
// needs no AI parsing (unlike the in-app widget, which extracts fields
// from a free-form transcript).
const ONBOARDING_QUESTIONS: { field: string; text: string }[] = [
  { field: "company_name", text: "Kompaniyangiz nomi qanday?" },
  { field: "description", text: "Biznesingiz haqida qisqacha yozing — nima bilan shug'ullanasiz?" },
  {
    field: "competitors",
    text: "Asosiy raqobatchilaringiz kimlar? Bo'lmasa \"yo'q\" deb yozing.",
  },
  {
    field: "terminology",
    text: "Biznesingizga xos atamalar yoki jargon bormi? Bo'lmasa \"yo'q\" deb yozing.",
  },
  {
    field: "tone",
    text: "AI yordamchi qanday ohangda gapirishini xohlaysiz? (masalan: rasmiy, do'stona, qisqa)",
  },
];

async function continueOnboarding(
  chatId: number,
  profile: { id: string; organization_id: string; telegram_onboarding_step: number | null },
  answerText: string,
) {
  const step = profile.telegram_onboarding_step ?? 0;
  const { data: current } = await supabaseAdmin
    .from("profiles")
    .select("telegram_onboarding_answers")
    .eq("id", profile.id)
    .maybeSingle();
  const answers = {
    ...((current?.telegram_onboarding_answers as Record<string, string> | null) ?? {}),
    [ONBOARDING_QUESTIONS[step]!.field]: answerText.trim(),
  };

  const nextStep = step + 1;
  if (nextStep < ONBOARDING_QUESTIONS.length) {
    await supabaseAdmin
      .from("profiles")
      .update({ telegram_onboarding_step: nextStep, telegram_onboarding_answers: answers })
      .eq("id", profile.id);
    await sendTelegramMessage(chatId, ONBOARDING_QUESTIONS[nextStep]!.text).catch(() => undefined);
    return;
  }

  await supabaseAdmin.from("business_profile").upsert(
    {
      organization_id: profile.organization_id,
      updated_by: profile.id,
      ...answers,
    },
    { onConflict: "organization_id" },
  );
  await supabaseAdmin
    .from("profiles")
    .update({ telegram_onboarding_step: null, telegram_onboarding_answers: null })
    .eq("id", profile.id);
  await sendTelegramMessage(
    chatId,
    "✅ Rahmat! Biznes profili to'ldirildi — buni istalgan vaqt Sozlamalar → Biznes profili bo'limida tahrirlashingiz mumkin.",
  ).catch(() => undefined);
}

async function maybeStartOnboarding(
  chatId: number,
  profile: { id: string; full_name: string; organization_id: string; role: string },
) {
  if (profile.role !== "super_admin" && profile.role !== "rop" && profile.role !== "platform_owner")
    return false;
  const { data: bp } = await supabaseAdmin
    .from("business_profile")
    .select("company_name")
    .eq("organization_id", profile.organization_id)
    .maybeSingle();
  if (bp?.company_name?.trim()) return false;

  await supabaseAdmin
    .from("profiles")
    .update({ telegram_onboarding_step: 0, telegram_onboarding_answers: {} })
    .eq("id", profile.id);
  await sendTelegramMessage(
    chatId,
    `Salom, ${profile.full_name || "hurmatli foydalanuvchi"}! Endi biznes profilingizni birga to'ldiramiz — AI yordamchi shu ma'lumotlardan foydalanadi. ${ONBOARDING_QUESTIONS[0]!.text}`,
  ).catch(() => undefined);
  return true;
}

export const Route = createFileRoute("/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["TELEGRAM_WEBHOOK_SECRET"];
        if (expected) {
          const got = request.headers.get("x-telegram-bot-api-secret-token");
          if (got !== expected) return Response.json({ ok: false }, { status: 401 });
        }

        const update = (await request.json().catch(() => ({}))) as TelegramUpdate;
        const chatId = update.message?.chat?.id;
        const rawText = update.message?.text ?? "";
        if (!chatId) return Response.json({ ok: true });

        const startMatch = rawText.match(/^\/start\s+(\S+)/);
        if (startMatch) {
          await startHrApplication(chatId, startMatch[1]!, update.message?.chat?.username);
          return Response.json({ ok: true });
        }
        if (await continueHrApplication(chatId, rawText)) {
          return Response.json({ ok: true });
        }

        // An ongoing onboarding conversation takes priority over code
        // matching — an answer like a company name could otherwise
        // accidentally look like an 8-character link code.
        const { data: linkedProfile } = await supabaseAdmin
          .from("profiles")
          .select("id, organization_id, telegram_onboarding_step")
          .eq("telegram_chat_id", chatId)
          .maybeSingle();
        if (linkedProfile && linkedProfile.telegram_onboarding_step !== null) {
          await continueOnboarding(chatId, linkedProfile, rawText);
          return Response.json({ ok: true });
        }

        const match = rawText.toUpperCase().match(CODE_RE);
        if (!match) {
          await sendTelegramMessage(
            chatId,
            "Ulash kodini topolmadim. SalesOS Elite ➝ Sozlamalar ➝ Telegram bot bo'limidan kodni oling va shu yerga yuboring.",
          ).catch(() => undefined);
          return Response.json({ ok: true });
        }

        const code = match[0];
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name, organization_id, role")
          .eq("telegram_link_code", code)
          .maybeSingle();

        if (!profile) {
          await sendTelegramMessage(
            chatId,
            "Bu kod topilmadi yoki eskirgan. Sozlamalardan yangi kod oling.",
          ).catch(() => undefined);
          return Response.json({ ok: true });
        }

        await supabaseAdmin
          .from("profiles")
          .update({ telegram_chat_id: chatId, telegram_link_code: null })
          .eq("id", profile.id);

        await sendTelegramMessage(
          chatId,
          `✅ Ulandi! Endi kunlik hisobotlar shu yerga keladi, ${profile.full_name || "hurmatli foydalanuvchi"}.`,
        ).catch(() => undefined);

        await maybeStartOnboarding(chatId, profile);

        return Response.json({ ok: true });
      },
    },
  },
});
