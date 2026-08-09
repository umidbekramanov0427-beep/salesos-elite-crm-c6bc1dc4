// Server-only. Builds the daily team report text and sends it via the
// Telegram Bot API. Used by both the scheduled send and the "send test"
// button, so the two never drift apart.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function requireBotToken(): string {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("Missing environment variable: TELEGRAM_BOT_TOKEN");
  return token;
}

export async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  const token = requireBotToken();
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  if (!res.ok) throw new Error(`Telegram sendMessage failed (${res.status}): ${await res.text()}`);
}

export async function buildDailyReportText(): Promise<string> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);

  const [profilesRes, dealsRes, sessionsRes, callsRes] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, full_name, email, role, monthly_target"),
    supabaseAdmin.from("deals").select("owner_id, value, status, close_date"),
    supabaseAdmin.from("work_sessions").select("profile_id, clock_in"),
    supabaseAdmin.from("call_logs").select("profile_id, created_at"),
  ]);

  const profiles = profilesRes.data ?? [];
  const deals = dealsRes.data ?? [];
  const sessions = sessionsRes.data ?? [];
  const calls = callsRes.data ?? [];

  const reps = profiles.filter((p) => p.role !== "super_admin" || profiles.length === 1);

  let revenueToday = 0;
  let revenueMonth = 0;
  let behindCount = 0;
  let topName = "";
  let topRevenue = 0;

  for (const p of reps) {
    const won = deals.filter((d) => d.owner_id === p.id && d.status === "won" && d.close_date);
    const today = won
      .filter((d) => new Date(d.close_date!) >= startOfToday)
      .reduce((s, d) => s + Number(d.value), 0);
    const month = won
      .filter((d) => new Date(d.close_date!) >= startOfMonth)
      .reduce((s, d) => s + Number(d.value), 0);
    revenueToday += today;
    revenueMonth += month;
    if (today > topRevenue) {
      topRevenue = today;
      topName = p.full_name || p.email;
    }
    const monthlyTarget = p.monthly_target || 1;
    const dayOfMonth = new Date().getDate();
    const daysInMonth = new Date(
      startOfToday.getFullYear(),
      startOfToday.getMonth() + 1,
      0,
    ).getDate();
    const expectedByNow = monthlyTarget * (dayOfMonth / daysInMonth);
    if (month < expectedByNow * 0.6) behindCount++;
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

export async function sendDailyReportToLinkedManagers(): Promise<{ sent: number; failed: number }> {
  const text = await buildDailyReportText();
  const { data: recipients } = await supabaseAdmin
    .from("profiles")
    .select("id, telegram_chat_id, role")
    .not("telegram_chat_id", "is", null)
    .in("role", ["super_admin", "manager"]);

  let sent = 0;
  let failed = 0;
  for (const r of recipients ?? []) {
    if (!r.telegram_chat_id) continue;
    try {
      await sendTelegramMessage(r.telegram_chat_id, text);
      sent++;
    } catch {
      failed++;
    }
  }
  return { sent, failed };
}
