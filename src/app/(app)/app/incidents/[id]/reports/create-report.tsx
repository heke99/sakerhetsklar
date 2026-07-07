"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

const stages = [
  { key: "early_warning_24h", label: "Upplysning (24h)" },
  { key: "incident_notification_72h", label: "Incidentanmälan (72h)" },
  { key: "final_report", label: "Slutrapport" },
  { key: "situation_report", label: "Lägesrapport" },
];

export function CreateReportButtons({
  tenantId,
  incidentId,
  existingStages,
  hasStateAgencyTrack,
  hasGdprTrack,
  hasEidasTrack,
}: {
  tenantId: string;
  incidentId: string;
  existingStages: string[];
  hasStateAgencyTrack: boolean;
  hasGdprTrack: boolean;
  hasEidasTrack: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const allStages = [
    ...stages,
    ...(hasStateAgencyTrack ? [{ key: "state_agency_6h", label: "Statlig varning (6h)" }] : []),
    ...(hasGdprTrack ? [{ key: "imy_report", label: "Anmälan till IMY" }] : []),
    ...(hasEidasTrack ? [{ key: "eidas_report", label: "eIDAS-rapport" }] : []),
  ];

  async function create(stage: string) {
    setBusy(stage);
    try {
      const res = await fetch(`/api/v1/incidents/${incidentId}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, stage }),
      });
      if (res.ok) {
        const body = await res.json();
        router.push(`/app/reports/${body.data.id}`);
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="mb-3 text-lg font-semibold">Skapa rapportutkast</h2>
      <div className="flex flex-wrap gap-2">
        {allStages.map((s) => (
          <Button
            key={s.key}
            variant={existingStages.includes(s.key) ? "outline" : "default"}
            disabled={busy !== null}
            onClick={() => create(s.key)}
          >
            {busy === s.key
              ? "Skapar…"
              : existingStages.includes(s.key)
                ? `${s.label} (finns)`
                : s.label}
          </Button>
        ))}
      </div>
    </section>
  );
}
