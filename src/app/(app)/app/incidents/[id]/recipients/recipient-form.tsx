"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function RecipientDecisionForm({
  tenantId,
  incidentId,
}: {
  tenantId: string;
  incidentId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [affectedServices, setAffectedServices] = useState("");
  const [affectedRecipients, setAffectedRecipients] = useState("");
  const [requiredAction, setRequiredAction] = useState("");
  const [consequence, setConsequence] = useState("");
  const [decision, setDecision] = useState("inform_now");
  const [reason, setReason] = useState("");
  const [messageDraft, setMessageDraft] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/incidents/${incidentId}/recipients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          affectedServices: affectedServices || undefined,
          affectedRecipients: affectedRecipients || undefined,
          requiredAction: requiredAction || undefined,
          consequenceIfNoAction: consequence || undefined,
          decision,
          decisionReason: reason,
          messageDraft: messageDraft || undefined,
        }),
      });
      if (!res.ok) {
        setError("Beslutet kunde inte sparas.");
        return;
      }
      setReason("");
      setMessageDraft("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-card p-6">
      <h2 className="text-lg font-semibold">Nytt beslut</h2>

      <div className="space-y-1.5">
        <Label htmlFor="rn-services">Vilka externa tjänster är påverkade?</Label>
        <Textarea id="rn-services" rows={2} value={affectedServices} onChange={(e) => setAffectedServices(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rn-recipients">Vilka mottagare/kunder använder tjänsterna?</Label>
        <Textarea id="rn-recipients" rows={2} value={affectedRecipients} onChange={(e) => setAffectedRecipients(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rn-action">Vilka åtgärder behöver mottagarna vidta?</Label>
        <Textarea id="rn-action" rows={2} value={requiredAction} onChange={(e) => setRequiredAction(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rn-consequence">Vad händer om de inte agerar?</Label>
        <Textarea id="rn-consequence" rows={2} value={consequence} onChange={(e) => setConsequence(e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rn-decision">Beslut</Label>
        <select
          id="rn-decision"
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
        >
          <option value="inform_now">Informera nu</option>
          <option value="wait_would_worsen_handling">
            Vänta — information nu kan försvåra incidenthanteringen
          </option>
          <option value="do_not_inform">Informera inte (motivering krävs)</option>
          <option value="manual_review">Manuell granskning krävs</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rn-reason">Motivering * </Label>
        <Textarea id="rn-reason" required rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rn-message">Meddelandeutkast till mottagare</Label>
        <Textarea id="rn-message" rows={4} value={messageDraft} onChange={(e) => setMessageDraft(e.target.value)} />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={busy || reason.length < 5}>
        {busy ? "Sparar…" : "Spara beslut (godkänns av dig)"}
      </Button>
    </form>
  );
}
