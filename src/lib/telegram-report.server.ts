// Server-only. Builds the daily team report text and sends it via the
// Telegram Bot API. Used by both the scheduled send and the "send test"
// button, so the two never drift apart.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildFullDailyReport, buildPersonalDailyReport } from "@/lib/daily-report-builder.server";
import { appendRowToGoogleSheet } from "@/lib/google-sheets.server";

function requireBotToken(): string {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("Missing environment variable: TELEGRAM_BOT_TOKEN");
  return token;
}

function requireHrBotToken(): string {
  const token = process.env["TELEGRAM_HR_BOT_TOKEN"];
  if (!token) throw new Error("Missing environment variable: TELEGRAM_HR_BOT_TOKEN");
  return token;
}

// No default timeout on fetch() -- a stalled connection to Telegram used
// to hang this call indefinitely, which is worse than it looks here since
// this runs in a loop over every recipient in the scheduled daily-report
// job (see sendDailyReportToLinkedManagers below): one stuck request could
// stall the report for every remaining org/recipient behind it.
async function callTelegramMethod(
  token: string,
  method: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  let res: Response;
  try {
    res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`Telegram ${method} failed (${res.status}): ${await res.text()}`);
}

async function sendViaBotToken(token: string, chatId: number, text: string): Promise<void> {
  await callTelegramMethod(token, "sendMessage", { chat_id: chatId, text, parse_mode: "HTML" });
}

export async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  await sendViaBotToken(requireBotToken(), chatId, text);
}

// Kadrlar bo'limi runs on its own, separate Telegram bot (a dedicated
// @kadrlar_uchun_bot-style bot, not the reports/onboarding bot above) --
// Telegram gives a webhook no way to tell which bot an update came through,
// so two unrelated bots can never safely share one webhook route or token.
export async function sendHrTelegramMessage(chatId: number, text: string): Promise<void> {
  await sendViaBotToken(requireHrBotToken(), chatId, text);
}

// Telegram fetches photo/document/audio straight from the given URL itself
// -- no need to proxy the file bytes through our own server -- so these
// just need the public Supabase Storage URL the chat panel already has.
export async function sendHrTelegramPhoto(
  chatId: number,
  photoUrl: string,
  caption?: string,
): Promise<void> {
  await callTelegramMethod(requireHrBotToken(), "sendPhoto", {
    chat_id: chatId,
    photo: photoUrl,
    caption,
  });
}

export async function sendHrTelegramDocument(
  chatId: number,
  documentUrl: string,
  caption?: string,
): Promise<void> {
  await callTelegramMethod(requireHrBotToken(), "sendDocument", {
    chat_id: chatId,
    document: documentUrl,
    caption,
  });
}

export async function sendHrTelegramAudio(
  chatId: number,
  audioUrl: string,
  caption?: string,
): Promise<void> {
  await callTelegramMethod(requireHrBotToken(), "sendAudio", {
    chat_id: chatId,
    audio: audioUrl,
    caption,
  });
}

export async function sendHrTelegramLocation(
  chatId: number,
  lat: number,
  lng: number,
): Promise<void> {
  await callTelegramMethod(requireHrBotToken(), "sendLocation", {
    chat_id: chatId,
    latitude: lat,
    longitude: lng,
  });
}

// Resolves a Telegram file_id to bytes and re-hosts it in our own storage,
// so the CRM's chat panel can display it without ever handing the bot
// token to the browser (Telegram's file-download URL embeds it).
export async function rehostHrTelegramFile(fileId: string, extHint: string): Promise<string> {
  const token = requireHrBotToken();
  const infoRes = await fetch(
    `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`,
  );
  const info = (await infoRes.json()) as { ok?: boolean; result?: { file_path?: string } };
  const filePath = info.result?.file_path;
  if (!info.ok || !filePath) throw new Error("Telegram getFile failed");

  const fileRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
  if (!fileRes.ok) throw new Error(`Telegram file download failed (${fileRes.status})`);
  const blob = await fileRes.blob();

  const ext = filePath.includes(".") ? filePath.split(".").pop() : extHint;
  const objectPath = `telegram/${crypto.randomUUID()}.${ext || extHint}`;
  const { error } = await supabaseAdmin.storage
    .from("hr-chat-attachments")
    .upload(objectPath, blob, blob.type ? { contentType: blob.type } : {});
  if (error) throw new Error(error.message);

  const { data: pub } = supabaseAdmin.storage.from("hr-chat-attachments").getPublicUrl(objectPath);
  return pub.publicUrl;
}

// Every org's send time is entered and shown as a Tashkent wall-clock time
// (the platform's one supported business timezone, same assumption the
// original fixed 23:50 cron already made) -- these convert between that and
// the UTC clock this server actually runs on.
function tashkentNow(): Date {
  return new Date(Date.now() + 5 * 60 * 60 * 1000);
}

function tashkentDateString(): string {
  return tashkentNow().toISOString().slice(0, 10);
}

// The scheduler (see the pg_cron migration) polls this endpoint every few
// minutes rather than once at a single fixed time, so every org's own
// configured send_time can be honored -- this is true once `nowMinutes`
// lands inside [target, target + windowMinutes) of that org's send_time,
// wrapping past midnight.
function isWithinSendWindow(sendTime: string, windowMinutes: number): boolean {
  const [h, m] = sendTime.split(":").map(Number);
  const targetMinutes = (h ?? 0) * 60 + (m ?? 0);
  const now = tashkentNow();
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const diff = (nowMinutes - targetMinutes + 1440) % 1440;
  return diff < windowMinutes;
}

/**
 * Polled every few minutes (see the pg_cron migration); actually sends for
 * an org only once its own configured send_time comes around, and at most
 * once per org per day (daily_report_history doubles as the "already sent
 * today" guard). Super Admin and ROP get the full, fully-configured "Kunlik
 * hisobot" (identical to the "Hisobot namunasi" preview); each Sotuv
 * menejeri gets their own personal, self-scoped report instead of the full
 * company report. The full report is also saved into daily_report_history
 * and pushed to the org's Google Sheet (if configured) independent of
 * whether any Telegram send below succeeds.
 */
export async function sendDailyReportToLinkedManagers(): Promise<{ sent: number; failed: number }> {
  const { data: orgs } = await supabaseAdmin.from("organizations").select("id").eq("active", true);

  let sent = 0;
  let failed = 0;
  const reportDate = tashkentDateString();
  for (const org of orgs ?? []) {
    const { data: reportSettings } = await supabaseAdmin
      .from("daily_report_settings")
      .select("send_enabled, send_time, google_sheets_url")
      .eq("organization_id", org.id)
      .maybeSingle();
    if (!(reportSettings?.send_enabled ?? true)) continue;

    const { data: alreadySent } = await supabaseAdmin
      .from("daily_report_history")
      .select("id")
      .eq("organization_id", org.id)
      .eq("report_date", reportDate)
      .maybeSingle();
    if (alreadySent) continue;

    if (!isWithinSendWindow(reportSettings?.send_time ?? "23:50:00", 5)) continue;

    const { text: fullText } = await buildFullDailyReport(org.id);

    await supabaseAdmin
      .from("daily_report_history")
      .upsert(
        { organization_id: org.id, report_date: reportDate, report_text: fullText },
        { onConflict: "organization_id,report_date" },
      );

    // Auto-push the same full report into the org's own Google Sheet, if its
    // super_admin has entered one -- appendRowToGoogleSheet silently no-ops
    // until a Google service account is configured on the server, so this
    // is safe to always attempt.
    if (reportSettings?.google_sheets_url) {
      try {
        await appendRowToGoogleSheet(reportSettings.google_sheets_url, [reportDate, fullText]);
      } catch {
        // Sheets push failing must never block the Telegram sends below.
      }
    }

    const { data: recipients } = await supabaseAdmin
      .from("profiles")
      .select("id, telegram_chat_id, role")
      .eq("organization_id", org.id)
      .not("telegram_chat_id", "is", null)
      .in("role", ["super_admin", "rop", "sotuv_menejeri"]);

    for (const r of recipients ?? []) {
      if (!r.telegram_chat_id) continue;
      try {
        const text =
          r.role === "sotuv_menejeri" ? await buildPersonalDailyReport(org.id, r.id) : fullText;
        await sendTelegramMessage(r.telegram_chat_id, text);
        sent++;
      } catch {
        failed++;
      }
    }
  }
  return { sent, failed };
}
