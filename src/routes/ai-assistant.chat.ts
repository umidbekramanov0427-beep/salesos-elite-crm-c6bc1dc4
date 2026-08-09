import { createFileRoute } from "@tanstack/react-router";
import { getRequestUserId } from "@/lib/auth.server";

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

        const res = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: "deepseek-chat",
            temperature: 0.4,
            messages: [
              {
                role: "system",
                content:
                  "You are the AI assistant built into SalesOS Elite, a CRM for sales teams. Be concise and practical. Reply in the same language the user writes in.",
              },
              ...messages,
            ],
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
