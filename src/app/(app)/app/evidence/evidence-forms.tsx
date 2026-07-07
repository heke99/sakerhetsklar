"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EvidenceUploadForm({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [classification, setClassification] = useState("internal");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("tenantId", tenantId);

    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/evidence", { method: "POST", body: fd });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(body?.error?.message ?? "Uppladdningen misslyckades.");
        return;
      }
      setMessage("Bevis uppladdat. Hash och spårbarhetskedja registrerad.");
      form.reset();
      setClassification("internal");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const isRestricted = classification === "potentially_security_classified";

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4 rounded-xl border bg-card p-5">
      <h2 className="text-lg font-semibold">Ladda upp bevis</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ev-file">Fil * (max 50 MB)</Label>
          <Input id="ev-file" name="file" type="file" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ev-type">Bevistyp</Label>
          <select
            id="ev-type"
            name="evidenceType"
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
            defaultValue="other"
          >
            <option value="logs">Loggar</option>
            <option value="screenshot">Skärmbild</option>
            <option value="siem_export">SIEM-export</option>
            <option value="edr_alert">EDR-larm</option>
            <option value="soc_report">SOC-rapport</option>
            <option value="forensic_report">Forensisk rapport</option>
            <option value="email">E-post</option>
            <option value="meeting_minutes">Mötesanteckningar</option>
            <option value="decision">Beslut</option>
            <option value="cyberportal_receipt">Cyberportalen-kvitto</option>
            <option value="imy_receipt">IMY-kvitto</option>
            <option value="pts_eidas_receipt">PTS/eIDAS-kvitto</option>
            <option value="vendor_statement">Leverantörsutlåtande</option>
            <option value="customer_communication">Kundkommunikation</option>
            <option value="remediation_plan">Åtgärdsplan</option>
            <option value="control_evidence">Kontrollbevis</option>
            <option value="other">Övrigt</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ev-class">Klassificering</Label>
          <select
            id="ev-class"
            name="classification"
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
            value={classification}
            onChange={(e) => setClassification(e.target.value)}
          >
            <option value="open">Öppen</option>
            <option value="internal">Intern</option>
            <option value="confidential">Konfidentiell</option>
            <option value="strictly_confidential">Strikt konfidentiell</option>
            <option value="security_sensitive">Säkerhetskänslig</option>
            <option value="potentially_security_classified">
              Potentiellt säkerhetsskyddsklassificerad
            </option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ev-source">Källa</Label>
          <Input id="ev-source" name="source" placeholder="ex. SIEM, leverantör" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="ev-notes">Spårbarhetsanteckning</Label>
          <Input
            id="ev-notes"
            name="chainOfCustodyNotes"
            placeholder="ex. exporterad av NN kl 14:32 från produktionsmiljön"
          />
        </div>
      </div>

      {isRestricted ? (
        <p role="alert" className="rounded-lg border border-purple-300 bg-purple-50 px-4 py-3 text-sm text-purple-900 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-200">
          Ladda inte upp säkerhetsskyddsklassificerade uppgifter om inte er
          deployment och hanteringsprocess är godkänd för den typen av
          information.
        </p>
      ) : null}

      {message ? <p className="text-sm">{message}</p> : null}
      <Button type="submit" disabled={busy}>
        {busy ? "Laddar upp…" : "Ladda upp"}
      </Button>
    </form>
  );
}

export function EvidenceDownloadButton({
  tenantId,
  evidenceId,
  restricted,
}: {
  tenantId: string;
  evidenceId: string;
  restricted: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    let reason: string | undefined;
    if (restricted) {
      reason = window.prompt("Ange skäl för åtkomst till begränsat bevis:") ?? undefined;
      if (!reason) return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/evidence/${evidenceId}/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, reason }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error?.message ?? "Nedladdning nekad");
        return;
      }
      window.open(body.data.url, "_blank", "noopener");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span>
      <Button size="xs" variant="outline" onClick={download} disabled={busy}>
        Ladda ner
      </Button>
      {error ? <span className="ml-2 text-xs text-destructive">{error}</span> : null}
    </span>
  );
}
