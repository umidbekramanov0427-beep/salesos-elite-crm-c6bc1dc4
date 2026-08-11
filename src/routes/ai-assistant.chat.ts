import { createFileRoute } from "@tanstack/react-router";
import { getRequestUserId } from "@/lib/auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ChatMessage = { role: "user" | "assistant"; content: string };

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(`Missing environment variable: ${name}. Add it in Settings -> Secrets.`);
  return value;
}

export const Route = createFileRoute("/ai-assistant/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await getRequestUserId(request);
        if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const body = (await request.json().catch(() => ({}))) as { messages?: ChatMessage[] };
        const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
        if (messages.length === 0) {
          return Response.json({ error: "No messages provided." }, { status: 400 });
        }

        let apiKey: string;
        try {
          apiKey = requireEnv("DEEPSEEK_API_KEY");
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Missing DEEPSEEK_API_KEY" },
            { status: 500 },
          );
        }

        const { data: caller } = await supabaseAdmin
          .from("profiles")
          .select("organization_id")
          .eq("id", userId)
          .maybeSingle();

        const { data: profile } = caller?.organization_id
          ? await supabaseAdmin
              .from("business_profile")
              .select("company_name, description, competitors, terminology, tone")
              .eq("organization_id", caller.organization_id)
              .maybeSingle()
          : { data: null };

        let systemPrompt =
          "You are the AI assistant built into SalesOS Elite, a CRM for sales teams. Be concise and practical. Reply in the same language the user writes in.";
        if (profile) {
          const context = [
            profile.company_name && `Company: ${profile.company_name}`,
            profile.description && `About the business: ${profile.description}`,
            profile.competitors && `Known competitors: ${profile.competitors}`,
            profile.terminology && `Business-specific terms/jargon: ${profile.terminology}`,
            profile.tone && `Preferred tone of voice: ${profile.tone}`,
          ]
            .filter(Boolean)
            .join("\n");
          if (context) systemPrompt += `\n\nBusiness context:\n${context}`;
        }

        const res = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: "deepseek-chat",
            temperature: 0.4,
            messages: [{ role: "system", content: systemPrompt }, ...messages],
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          return Response.json(
            { error: `DeepSeek error (${res.status}): ${text}` },
            { status: 502 },
          );
        }

        const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const reply = json.choices?.[0]?.message?.content ?? "";
        return Response.json({ reply });
      },
    },
  },
});
