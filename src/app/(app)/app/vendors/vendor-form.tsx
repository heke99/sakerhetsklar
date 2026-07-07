"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function VendorForm({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [orgNr, setOrgNr] = useState("");
  const [incidentContactName, setIncidentContactName] = useState("");
  const [incidentContactEmail, setIncidentContactEmail] = useState("");
  const [has247, setHas247] = useState(false);
  const [dpaExists, setDpaExists] = useState(false);
  const [personalDataProcessor, setPersonalDataProcessor] = useState(false);
  const [riskRating, setRiskRating] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          name,
          organizationNumber: orgNr || undefined,
          incidentContactName: incidentContactName || undefined,
          incidentContactEmail: incidentContactEmail || undefined,
          has247Contact: has247,
          dpaExists,
          personalDataProcessor,
          riskRating: riskRating || undefined,
        }),
      });
      if (!res.ok) {
        setError("Kunde inte skapa leverantören.");
        return;
      }
      setName("");
      setOrgNr("");
      setIncidentContactName("");
      setIncidentContactEmail("");
      setHas247(false);
      setDpaExists(false);
      setPersonalDataProcessor(false);
      setRiskRating("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4 rounded-xl border bg-card p-5">
      <h2 className="text-lg font-semibold">Lägg till leverantör</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="v-name">Namn *</Label>
          <Input id="v-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="v-org">Organisationsnummer</Label>
          <Input id="v-org" value={orgNr} onChange={(e) => setOrgNr(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="v-icn">Incidentkontakt (namn)</Label>
          <Input
            id="v-icn"
            value={incidentContactName}
            onChange={(e) => setIncidentContactName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="v-ice">Incidentkontakt (e-post)</Label>
          <Input
            id="v-ice"
            type="email"
            value={incidentContactEmail}
            onChange={(e) => setIncidentContactEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="v-risk">Riskklass</Label>
          <select
            id="v-risk"
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
            value={riskRating}
            onChange={(e) => setRiskRating(e.target.value)}
          >
            <option value="">Ej bedömd</option>
            <option value="low">Låg</option>
            <option value="medium">Medel</option>
            <option value="high">Hög</option>
            <option value="critical">Kritisk</option>
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={has247} onChange={(e) => setHas247(e.target.checked)} />
          24/7-kontakt finns
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={personalDataProcessor}
            onChange={(e) => setPersonalDataProcessor(e.target.checked)}
          />
          Personuppgiftsbiträde
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={dpaExists}
            onChange={(e) => setDpaExists(e.target.checked)}
          />
          PUB-avtal (DPA) finns
        </label>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={busy}>
        {busy ? "Sparar…" : "Skapa leverantör"}
      </Button>
    </form>
  );
}
