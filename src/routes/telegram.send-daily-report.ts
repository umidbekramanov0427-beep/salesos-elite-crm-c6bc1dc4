import { createFileRoute } from "@tanstack/react-router";
import { sendDailyReportToLinkedManagers } from "@/lib/telegram-report.server";

export const Route = createFileRoute("/telegram/send-daily-report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["CRON_SECRET"];
        const got = request.headers.get("x-cron-secret");
        if (!expected || got !== expected) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        try {
          const result = await sendDailyReportToLinkedManagers();
          return Response.json(result);
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Failed to send report" },
            { status: 500 },
          );
        }
      },
    },
  },
});
