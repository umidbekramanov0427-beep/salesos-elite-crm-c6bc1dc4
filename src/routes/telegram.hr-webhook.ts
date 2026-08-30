// Server-only. Webhook for the dedicated Kadrlar bo'limi Telegram bot --
// a separate bot/token from the reports+onboarding bot in
// telegram.webhook.ts, on its own URL, since Telegram gives no way to tell
// which bot an update came through when two bots share one webhook.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendHrTelegramMessage, rehostHrTelegramFile } from "@/lib/telegram-report.server";

type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: { id?: number; username?: string };
    photo?: { file_id: string }[];
    document?: { file_id: string; file_name?: string };
    voice?: { file_id: string };
    audio?: { file_id: string; file_name?: string };
    location?: { latitude: number; longitude: number };
  };
};

// A job-posting link is `t.me/<hr-bot>?start=<token>`, which Telegram
// delivers to the webhook as the literal message text "/start <token>".
// A chat that has ever applied before (to this or any other vacancy) is
// refused a second application -- see hr_candidates_telegram_chat_id_key.
async function startHrApplication(
  chatId: number,
  token: string,
  username: string | undefined,
): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from("hr_candidates")
    .select("id")
    .eq("telegram_chat_id", chatId)
    .limit(1)
    .maybeSingle();
  if (existing) {
    await sendHrTelegramMessage(
      chatId,
      "Siz allaqachon ariza topshirgansiz. Har bir nomzod faqat bir marta ariza topshira oladi.",
    ).catch(() => undefined);
    return;
  }

  const { data: vacancy } = await supabaseAdmin
    .from("hr_vacancies")
    .select("id, organization_id, title, active")
    .eq("telegram_start_token", token)
    .maybeSingle();
  if (!vacancy || !vacancy.active) {
    await sendHrTelegramMessage(
      chatId,
      "Bu vakansiya havolasi topilmadi yoki endi faol emas.",
    ).catch(() => undefined);
    return;
  }

  const { data: questions } = await supabaseAdmin
    .from("hr_questions")
    .select("id, question, position")
    .eq("organization_id", vacancy.organization_id)
    .order("position", { ascending: true });

  if (!questions || questions.length === 0) {
    await sendHrTelegramMessage(
      chatId,
      "Hozircha bu vakansiya uchun savollar sozlanmagan. Iltimos, keyinroq qayta urinib ko'ring.",
    ).catch(() => undefined);
    return;
  }

  const { error: insertError } = await supabaseAdmin.from("hr_candidates").insert({
    organization_id: vacancy.organization_id,
    vacancy_id: vacancy.id,
    telegram_chat_id: chatId,
    telegram_username: username ?? null,
    current_question_position: 0,
  });
  // 23505 = unique_violation -- a second /start slipped in before the
  // pre-check above completed; treat it the same as the normal duplicate case.
  if (insertError) {
    const message =
      insertError.code === "23505"
        ? "Siz allaqachon ariza topshirgansiz. Har bir nomzod faqat bir marta ariza topshira oladi."
        : "Arizangizni saqlab bo'lmadi. Iltimos, keyinroq qayta urinib ko'ring.";
    await sendHrTelegramMessage(chatId, message).catch(() => undefined);
    return;
  }

  await sendHrTelegramMessage(
    chatId,
    `Assalomu alaykum! "${vacancy.title}" vakansiyasiga murojaatingiz uchun rahmat. Sizga bir nechta savol beramiz.\n\n${questions[0]!.question}`,
  ).catch(() => undefined);
}

// Any incoming text from a chat with an unfinished application is that
// application's next answer.
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
    await sendHrTelegramMessage(chatId, nextQuestion.question).catch(() => undefined);
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
  await sendHrTelegramMessage(chatId, closingText).catch(() => undefined);
  return true;
}

// Once a candidate has finished the question flow, continueHrApplication no
// longer matches their chat (its query only looks at open applications) --
// any further message from them (text, photo, document, voice/audio, or a
// shared location) is a chat reply, not an answer, and gets appended to
// hr_candidate_messages so it shows up in the CRM's chat panel instead of
// triggering the generic "this is the HR bot" reply below.
async function logInboundMessage(
  chatId: number,
  message: NonNullable<TelegramUpdate["message"]>,
): Promise<boolean> {
  const { data: candidate } = await supabaseAdmin
    .from("hr_candidates")
    .select("id, organization_id")
    .eq("telegram_chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!candidate) return false;

  const row: {
    organization_id: string;
    candidate_id: string;
    direction: string;
    body: string | null;
    attachment_url?: string;
    attachment_type?: "image" | "document" | "audio" | "location";
    location_lat?: number;
    location_lng?: number;
  } = {
    organization_id: candidate.organization_id,
    candidate_id: candidate.id,
    direction: "inbound",
    body: message.text?.trim() || null,
  };

  try {
    if (message.photo?.length) {
      const largest = message.photo[message.photo.length - 1]!;
      row.attachment_url = await rehostHrTelegramFile(largest.file_id, "jpg");
      row.attachment_type = "image";
    } else if (message.document) {
      const ext = message.document.file_name?.split(".").pop() || "bin";
      row.attachment_url = await rehostHrTelegramFile(message.document.file_id, ext);
      row.attachment_type = "document";
    } else if (message.voice) {
      row.attachment_url = await rehostHrTelegramFile(message.voice.file_id, "ogg");
      row.attachment_type = "audio";
    } else if (message.audio) {
      const ext = message.audio.file_name?.split(".").pop() || "mp3";
      row.attachment_url = await rehostHrTelegramFile(message.audio.file_id, ext);
      row.attachment_type = "audio";
    } else if (message.location) {
      row.attachment_type = "location";
      row.location_lat = message.location.latitude;
      row.location_lng = message.location.longitude;
    }
  } catch {
    // Re-hosting failed -- still log whatever text came with it (if any)
    // rather than silently dropping the whole message.
  }

  if (!row.body && !row.attachment_type) return true;

  await supabaseAdmin.from("hr_candidate_messages").insert(row);
  return true;
}

export const Route = createFileRoute("/telegram/hr-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["TELEGRAM_HR_WEBHOOK_SECRET"];
        if (expected) {
          const got = request.headers.get("x-telegram-bot-api-secret-token");
          if (got !== expected) return Response.json({ ok: false }, { status: 401 });
        }

        const update = (await request.json().catch(() => ({}))) as TelegramUpdate;
        const chatId = update.message?.chat?.id;
        const rawText = update.message?.text ?? "";
        if (!chatId || !update.message) return Response.json({ ok: true });

        const startMatch = rawText.match(/^\/start\s+(\S+)/);
        if (startMatch) {
          await startHrApplication(chatId, startMatch[1]!, update.message.chat?.username);
          return Response.json({ ok: true });
        }

        if (await continueHrApplication(chatId, rawText)) {
          return Response.json({ ok: true });
        }

        if (await logInboundMessage(chatId, update.message)) {
          return Response.json({ ok: true });
        }

        await sendHrTelegramMessage(
          chatId,
          "Salom! Bu Kadrlar bo'limi boti — vakansiya e'lonidagi havola orqali murojaat qilishingiz mumkin.",
        ).catch(() => undefined);
        return Response.json({ ok: true });
      },
    },
  },
});
