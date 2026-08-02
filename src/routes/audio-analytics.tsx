import { createFileRoute } from "@tanstack/react-router";
import { Play, Sparkles } from "lucide-react";
import { PageHeader, SectionCard, StatCard, Pill } from "@/components/layout/Primitives";
import { CALLS } from "@/lib/mock-data";

export const Route = createFileRoute("/audio-analytics")({
  head: () => ({
    meta: [
      { title: "Audio Analytics — SalesOS Elite" },
      { name: "description", content: "AI call transcription, summaries, sentiment, objection detection and rep quality scoring." },
      { property: "og:title", content: "Audio Analytics — SalesOS Elite" },
      { property: "og:description", content: "AI call intelligence: sentiment, objections and quality scores." },
    ],
  }),
  component: AudioAnalytics,
});

function AudioAnalytics() {
  return (
    <>
      <PageHeader title="Audio Analytics" description="Every call transcribed, scored and turned into coaching signal." />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Calls analyzed" value="1,842" delta={14.2} hint="this month" tone="mint" />
        <StatCard label="Avg quality score" value="81" delta={3.4} hint="out of 100" />
        <StatCard label="Positive sentiment" value="62%" delta={1.9} />
        <StatCard label="Top objection" value="Pricing" hint="34% of calls" />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {CALLS.map((c) => (
            <SectionCard
              key={c.id}
              title={c.company}
              description={`${c.rep} · ${c.duration} · ${c.id}`}
              actions={
                <button className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent">
                  <Play className="h-4 w-4" /> Play
                </button>
              }
            >
              <p className="text-sm leading-relaxed text-muted-foreground">{c.summary}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Pill tone={c.sentiment === "Positive" ? "success" : c.sentiment === "Negative" ? "danger" : "neutral"}>
                  {c.sentiment}
                </Pill>
                <Pill tone="warning">Objection: {c.objection}</Pill>
                <Pill tone={c.score >= 80 ? "success" : "danger"}>Quality {c.score}</Pill>
              </div>
            </SectionCard>
          ))}
        </div>

        <div className="mint-card h-fit p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-mint-foreground" />
            <p className="text-sm font-semibold">Coaching signal</p>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Reps who reframe value before discussing price close 2.3x more often. Three SMB calls this week offered a
            discount inside the first six minutes — flag for manager review.
          </p>
        </div>
      </div>
    </>
  );
}
