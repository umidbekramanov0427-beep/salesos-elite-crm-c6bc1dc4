// Server-only. Builds the daily team report text and sends it via the
// Telegram Bot API. Used by both the scheduled send and the "send test"
// button, so the two never drift apart.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

export async function buildDailyReportText(organizationId: string): Promise<string> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);

  const [profilesRes, leadsRes, stagesRes, sessionsRes, callsRes] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, role, monthly_target")
      .eq("organization_id", organizationId),
    // Revenue used to come from `deals` — but this AmoCRM-synced setup
    // never populates that table (leads carry the real revenue), so the
    // report's revenue lines were always 0. Read won leads instead, same
    // as the rest of the app. Leads have no close_date, so updated_at is
    // used as a "when it closed" proxy (no per-lead stage-history to read
    // instead in this schema).
    supabaseAdmin
      .from("leads")
      .select("owner_id, expected_revenue, updated_at, stage_id")
      .eq("organization_id", organizationId),
    supabaseAdmin
      .from("pipeline_stages")
      .select("id, is_won")
      .eq("organization_id", organizationId),
    supabaseAdmin
      .from("work_sessions")
      .select("profile_id, clock_in")
      .eq("organization_id", organizationId),
    supabaseAdmin
      .from("call_logs")
      .select("profile_id, created_at")
      .eq("organization_id", organizationId),
  ]);

  const profiles = profilesRes.data ?? [];
  const leads = leadsRes.data ?? [];
  const wonStageIds = new Set((stagesRes.data ?? []).filter((s) => s.is_won).map((s) => s.id));
  const sessions = sessionsRes.data ?? [];
  const calls = callsRes.data ?? [];

  const reps = profiles.filter(
    (p) => (p.role !== "super_admin" && p.role !== "platform_owner") || profiles.length === 1,
  );

  let revenueToday = 0;
  let revenueMonth = 0;
  let behindCount = 0;
  let topName = "";
  let topRevenue = 0;

  for (const p of reps) {
    const won = leads.filter(
      (l) => l.owner_id === p.id && l.stage_id && wonStageIds.has(l.stage_id),
    );
    const today = won
      .filter((l) => new Date(l.updated_at) >= startOfToday)
      .reduce((s, l) => s + Number(l.expected_revenue), 0);
    const month = won
      .filter((l) => new Date(l.updated_at) >= startOfMonth)
      .reduce((s, l) => s + Number(l.expected_revenue), 0);
    revenueToday += today;
    revenueMonth += month;
    if (today > topRevenue) {
      topRevenue = today;
      topName = p.full_name || p.email;
    }
    const monthlyTarget = p.monthly_target;
    if (monthlyTarget && monthlyTarget > 0) {
      const dayOfMonth = new Date().getDate();
      const daysInMonth = new Date(
        startOfToday.getFullYear(),
        startOfToday.getMonth() + 1,
        0,
      ).getDate();
      const expectedByNow = monthlyTarget * (dayOfMonth / daysInMonth);
      if (month < expectedByNow * 0.6) behindCount++;
    }
  }

  const clockedInToday = new Set(
    sessions.filter((s) => new Date(s.clock_in) >= startOfToday).map((s) => s.profile_id),
  ).size;
  const callsToday = calls.filter((c) => new Date(c.created_at) >= startOfToday).length;

  const dateLabel = new Date().toLocaleDateString("uz-UZ", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const lines = [
    `📊 <b>Kunlik hisobot — ${dateLabel}</b>`,
    "",
    `💰 Bugungi tushum: <b>${revenueToday.toLocaleString("en-US")}</b>`,
    `📈 Shu oy tushumi: <b>${revenueMonth.toLocaleString("en-US")}</b>`,
    `🔴 Oylik rejadan orqada: <b>${behindCount}</b> kishi`,
    topName ? `🏆 Kun yetakchisi: <b>${topName}</b> (${topRevenue.toLocaleString("en-US")})` : "",
    `✅ Ishga chiqqanlar: <b>${clockedInToday}</b>/${reps.length}`,
    `📞 Jami qo‘ng‘iroqlar: <b>${callsToday}</b>`,
  ].filter(Boolean);

  return lines.join("\n");
}

/** Runs once daily across every active company, each getting its own report. */
export async function sendDailyReportToLinkedManagers(): Promise<{ sent: number; failed: number }> {
  const { data: orgs } = await supabaseAdmin.from("organizations").select("id").eq("active", true);

  let sent = 0;
  let failed = 0;
  for (const org of orgs ?? []) {
    const text = await buildDailyReportText(org.id);
    const { data: recipients } = await supabaseAdmin
      .from("profiles")
      .select("id, telegram_chat_id, role")
      .eq("organization_id", org.id)
      .not("telegram_chat_id", "is", null)
      .in("role", ["super_admin", "rop"]);

    for (const r of recipients ?? []) {
      if (!r.telegram_chat_id) continue;
      try {
        await sendTelegramMessage(r.telegram_chat_id, text);
        sent++;
      } catch {
        failed++;
      }
    }
  }
  return { sent, failed };
}
