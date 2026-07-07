"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/app/status-badge";

interface LateRecord {
  id: string;
  deadline_type: string;
  due_at: string;
  status: string;
  why_late: string | null;
  who_knew_what: string | null;
  why_not_identified_earlier: string | null;
  why_not_sent: string | null;
  prevention_actions: string | null;
  explanation_draft: string | null;
  supervisory_explanation_draft: string | null;
}

export function LateReportingForm({
  tenantId,
  incidentId,
  record,
}: {
  tenantId: string;
  incidentId: string;
  record: LateRecord;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [whyLate, setWhyLate] = useState(record.why_late ?? "");
  const [whoKnewWhat, setWhoKnewWhat] = useState(record.who_knew_what ?? "");
  const [whyNotEarlier, setWhyNotEarlier] = useState(record.why_not_identified_earlier ?? "");
  const [whyNotSent, setWhyNotSent] = useState(record.why_not_sent ?? "");
  const [prevention, setPrevention] = useState(record.prevention_actions ?? "");

  async function save(approve = false) {
    setBusy(true);
    try {
      await fetch(`/api/v1/incidents/${incidentId}/late-reporting`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          recordId: record.id,
          whyLate,
          whoKnewWhat,
          whyNotIdentifiedEarlier: whyNotEarlier,
          whyNotSent,
          preventionActions: prevention,
          approve,
        }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border bg-card p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">
          Missad deadline: {record.deadline_type}
        </h2>
        <StatusBadge color="red">
          Skulle ha skickats {new Date(record.due_at).toLocaleString("sv-SE")}
        </StatusBadge>
        <StatusBadge
          color={
            record.status === "approved"
              ? "green"
              : record.status === "explanation_drafted"
                ? "blue"
                : "yellow"
          }
        >
          {record.status}
        </StatusBadge>
      </div>

      <div className="grid gap-4">
        <div className="space-y-1.5">
          <Label htmlFor={`ll-why-${record.id}`}>Varför blev rapporten sen?</Label>
          <Textarea
            id={`ll-why-${record.id}`}
            rows={2}
            value={whyLate}
            onChange={(e) => setWhyLate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`ll-who-${record.id}`}>Vem visste vad och när?</Label>
          <Textarea
            id={`ll-who-${record.id}`}
            rows={2}
            value={whoKnewWhat}
            onChange={(e) => setWhoKnewWhat(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`ll-early-${record.id}`}>
            Varför identifierades inte betydelsen tidigare?
          </Label>
          <Textarea
            id={`ll-early-${record.id}`}
            rows={2}
            value={whyNotEarlier}
            onChange={(e) => setWhyNotEarlier(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`ll-sent-${record.id}`}>Varför skickades inte rapporten?</Label>
          <Textarea
            id={`ll-sent-${record.id}`}
            rows={2}
            value={whyNotSent}
            onChange={(e) => setWhyNotSent(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`ll-prev-${record.id}`}>
            Vilka åtgärder vidtas för att förhindra upprepning?
          </Label>
          <Textarea
            id={`ll-prev-${record.id}`}
            rows={2}
            value={prevention}
            onChange={(e) => setPrevention(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => save(false)} disabled={busy}>
          Spara och generera förklaringsutkast
        </Button>
        <Button
          onClick={() => save(true)}
          disabled={busy || record.status === "approved"}
          variant="outline"
        >
          Godkänn förklaringen (ledning)
        </Button>
      </div>

      {record.explanation_draft ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-primary">
            Visa internt förklaringsutkast
          </summary>
          <pre className="mt-2 rounded-lg border bg-muted/40 p-3 text-xs whitespace-pre-wrap">
            {record.explanation_draft}
          </pre>
        </details>
      ) : null}
      {record.supervisory_explanation_draft ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-medium text-primary">
            Visa utkast till tillsynsförklaring
          </summary>
          <pre className="mt-2 rounded-lg border bg-muted/40 p-3 text-xs whitespace-pre-wrap">
            {record.supervisory_explanation_draft}
          </pre>
        </details>
      ) : null}
    </section>
  );
}
