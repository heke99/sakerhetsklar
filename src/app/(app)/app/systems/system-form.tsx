"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SystemForm({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [systemType, setSystemType] = useState("");
  const [environment, setEnvironment] = useState("production");
  const [ownerName, setOwnerName] = useState("");
  const [rto, setRto] = useState("");
  const [rpo, setRpo] = useState("");
  const [sectorCritical, setSectorCritical] = useState(false);
  const [personalData, setPersonalData] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/systems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          name,
          systemType: systemType || undefined,
          environment,
          ownerName: ownerName || undefined,
          rtoHours: rto ? Number(rto) : undefined,
          rpoHours: rpo ? Number(rpo) : undefined,
          sectorCritical,
          personalData,
        }),
      });
      if (!res.ok) {
        setError("Kunde inte skapa systemet.");
        return;
      }
      setName("");
      setSystemType("");
      setOwnerName("");
      setRto("");
      setRpo("");
      setSectorCritical(false);
      setPersonalData(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-card p-5">
      <h2 className="text-lg font-semibold">Lägg till system</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sys-name">Namn *</Label>
          <Input id="sys-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sys-type">Typ</Label>
          <Input
            id="sys-type"
            placeholder="ex. SCADA, journalsystem"
            value={systemType}
            onChange={(e) => setSystemType(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sys-env">Miljö</Label>
          <select
            id="sys-env"
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
          >
            <option value="production">Produktion</option>
            <option value="test">Test</option>
            <option value="dev">Utveckling</option>
            <option value="training">Utbildning</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sys-owner">Systemägare</Label>
          <Input id="sys-owner" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sys-rto">RTO (timmar)</Label>
          <Input id="sys-rto" type="number" min={0} step="0.5" value={rto} onChange={(e) => setRto(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sys-rpo">RPO (timmar)</Label>
          <Input id="sys-rpo" type="number" min={0} step="0.5" value={rpo} onChange={(e) => setRpo(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={sectorCritical}
            onChange={(e) => setSectorCritical(e.target.checked)}
          />
          Sektorskritiskt system
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={personalData}
            onChange={(e) => setPersonalData(e.target.checked)}
          />
          Innehåller personuppgifter
        </label>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={busy}>
        {busy ? "Sparar…" : "Skapa system"}
      </Button>
    </form>
  );
}

export function SystemImport({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) return;

    setBusy(true);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.set("tenantId", tenantId);
      fd.set("file", file);
      const res = await fetch("/api/v1/systems/import", { method: "POST", body: fd });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(body?.error?.message ?? "Importen misslyckades.");
        return;
      }
      setMessage(
        `${body.data.imported} system importerade.` +
          (body.data.errors.length > 0 ? ` ${body.data.errors.length} rader hoppades över.` : ""),
      );
      form.reset();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-card p-5">
      <h2 className="text-lg font-semibold">Importera från Excel</h2>
      <p className="text-sm text-muted-foreground">
        Ladda upp en .xlsx-fil med rubrikrad. Kolumner som känns igen: Namn, Typ,
        Miljö, Ägare, Informationsägare, RTO, RPO, Sektorskritisk, Personuppgifter,
        Backup, Beskrivning.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="sys-file">Excel-fil</Label>
        <Input id="sys-file" name="file" type="file" accept=".xlsx" required />
      </div>
      {message ? <p className="text-sm">{message}</p> : null}
      <Button type="submit" disabled={busy} variant="outline">
        {busy ? "Importerar…" : "Importera"}
      </Button>
    </form>
  );
}
