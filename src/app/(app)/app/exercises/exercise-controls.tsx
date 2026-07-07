"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Scenario {
  code: string;
  title: string;
  description: string | null;
}

interface ActiveRun {
  id: string;
}

export function ExerciseControls({
  tenantId,
  scenarios,
  activeRun,
}: {
  tenantId: string;
  scenarios: Scenario[];
  activeRun: ActiveRun | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [scenarioCode, setScenarioCode] = useState(scenarios[0]?.code ?? "");
  const [participants, setParticipants] = useState("");
  const [decisions, setDecisions] = useState("");
  const [minutesToClassify, setMinutesToClassify] = useState("");
  const [minutesToDraft, setMinutesToDraft] = useState("");
  const [missedSteps, setMissedSteps] = useState("");
  const [score, setScore] = useState("");
  const [findings, setFindings] = useState("");
  const [actions, setActions] = useState("");

  async function start() {
    setBusy(true);
    try {
      await fetch("/api/v1/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          scenarioCode,
          participants: participants
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean),
        }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    if (!activeRun) return;
    setBusy(true);
    try {
      await fetch("/api/v1/exercises", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          runId: activeRun.id,
          decisions: decisions || undefined,
          minutesToClassify: minutesToClassify ? Number(minutesToClassify) : undefined,
          minutesToDraftReport: minutesToDraft ? Number(minutesToDraft) : undefined,
          missedSteps: missedSteps || undefined,
          score: score ? Number(score) : undefined,
          findings: findings
            ? findings
                .split("\n")
                .map((f) => f.trim())
                .filter(Boolean)
                .map((finding) => ({ finding, severity: "medium" as const }))
            : [],
          actions: actions
            ? actions
                .split("\n")
                .map((a) => a.trim())
                .filter(Boolean)
                .map((action) => ({ action }))
            : [],
        }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (activeRun) {
    return (
      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-3 text-lg font-semibold">Pågående övning — avsluta och dokumentera</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ex-classify">Tid till klassificering (minuter)</Label>
            <Input
              id="ex-classify"
              type="number"
              min={0}
              value={minutesToClassify}
              onChange={(e) => setMinutesToClassify(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ex-draft">Tid till rapportutkast (minuter)</Label>
            <Input
              id="ex-draft"
              type="number"
              min={0}
              value={minutesToDraft}
              onChange={(e) => setMinutesToDraft(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ex-decisions">Beslut som fattades</Label>
            <Textarea id="ex-decisions" rows={2} value={decisions} onChange={(e) => setDecisions(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ex-missed">Missade steg</Label>
            <Textarea id="ex-missed" rows={2} value={missedSteps} onChange={(e) => setMissedSteps(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ex-findings">Fynd (ett per rad)</Label>
            <Textarea id="ex-findings" rows={2} value={findings} onChange={(e) => setFindings(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ex-actions">Åtgärder (en per rad)</Label>
            <Textarea id="ex-actions" rows={2} value={actions} onChange={(e) => setActions(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ex-score">Poäng (0–100)</Label>
            <Input
              id="ex-score"
              type="number"
              min={0}
              max={100}
              value={score}
              onChange={(e) => setScore(e.target.value)}
            />
          </div>
        </div>
        <Button className="mt-4" onClick={complete} disabled={busy}>
          Avsluta övningen
        </Button>
      </section>
    );
  }

  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="mb-3 text-lg font-semibold">Starta ny övning</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ex-scenario">Scenario</Label>
          <select
            id="ex-scenario"
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
            value={scenarioCode}
            onChange={(e) => setScenarioCode(e.target.value)}
          >
            {scenarios.map((s) => (
              <option key={s.code} value={s.code}>
                {s.title}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            {scenarios.find((s) => s.code === scenarioCode)?.description}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ex-participants">Deltagare (kommaseparerade)</Label>
          <Input
            id="ex-participants"
            value={participants}
            onChange={(e) => setParticipants(e.target.value)}
            placeholder="ex. CISO, Incidentansvarig, Jurist"
          />
        </div>
      </div>
      <Button className="mt-4" onClick={start} disabled={busy || !scenarioCode}>
        Starta övning
      </Button>
    </section>
  );
}
