"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface LathundStep {
  id: string;
  number: number;
  title: string;
  description: string | null;
  linkPath: string | null;
}

interface Lathund {
  id: string;
  code: string;
  title: string;
  purpose: string | null;
  sourceReferences: string | null;
  steps: LathundStep[];
}

interface ActiveRun {
  id: string;
  lathundId: string;
  completedStepIds: string[];
}

export function LathundList({
  tenantId,
  lathunds,
  activeRuns,
}: {
  tenantId: string;
  lathunds: Lathund[];
  activeRuns: ActiveRun[];
}) {
  const router = useRouter();
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const runByLathund = new Map(activeRuns.map((r) => [r.lathundId, r]));

  async function startRun(code: string) {
    setBusy(true);
    try {
      await fetch("/api/v1/lathunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, lathundCode: code }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggleStep(runId: string, stepId: string, completed: boolean) {
    setBusy(true);
    try {
      await fetch("/api/v1/lathunds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, runId, stepId, completed }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {lathunds.map((lathund) => {
        const run = runByLathund.get(lathund.id);
        const completedCount = run
          ? lathund.steps.filter((s) => run.completedStepIds.includes(s.id)).length
          : 0;
        const isOpen = openCode === lathund.code;

        return (
          <div key={lathund.code} className="rounded-xl border bg-card">
            <button
              type="button"
              onClick={() => setOpenCode(isOpen ? null : lathund.code)}
              aria-expanded={isOpen}
              className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left"
            >
              <div className="min-w-0">
                <p className="font-medium">{lathund.title}</p>
                {lathund.purpose ? (
                  <p className="text-sm text-muted-foreground">{lathund.purpose}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                {run ? (
                  <div className="w-32">
                    <Progress
                      value={(completedCount / Math.max(lathund.steps.length, 1)) * 100}
                      aria-label={`${completedCount} av ${lathund.steps.length} steg klara`}
                    />
                  </div>
                ) : null}
                <span className="text-sm text-muted-foreground">
                  {lathund.steps.length} steg
                </span>
              </div>
            </button>

            {isOpen ? (
              <div className="border-t px-5 py-4">
                {!run ? (
                  <Button onClick={() => startRun(lathund.code)} disabled={busy} size="sm">
                    Starta lathund
                  </Button>
                ) : (
                  <ol className="space-y-2">
                    {lathund.steps.map((step) => {
                      const done = run.completedStepIds.includes(step.id);
                      return (
                        <li
                          key={step.id}
                          className={cn(
                            "flex items-start gap-3 rounded-lg border p-3",
                            done && "opacity-70",
                          )}
                        >
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={done}
                            disabled={busy}
                            aria-label={`Steg ${step.number}: ${step.title}`}
                            onChange={(e) => toggleStep(run.id, step.id, e.target.checked)}
                          />
                          <div className="min-w-0">
                            <p className={cn("text-sm font-medium", done && "line-through")}>
                              {step.number}. {step.title}
                            </p>
                            {step.description ? (
                              <p className="text-sm text-muted-foreground">{step.description}</p>
                            ) : null}
                            {step.linkPath ? (
                              <Link
                                href={step.linkPath}
                                className="text-sm text-primary hover:underline"
                              >
                                Öppna →
                              </Link>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
                {lathund.sourceReferences ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-medium text-primary">
                      Visa regelkälla
                    </summary>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {lathund.sourceReferences}
                    </p>
                  </details>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
