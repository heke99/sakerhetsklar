"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Option {
  id: string;
  name: string;
}

export function IncidentWizard({
  tenantId,
  systems,
  services,
  vendors,
}: {
  tenantId: string;
  systems: Option[];
  services: Option[];
  vendors: Option[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [incidentType, setIncidentType] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [suspectedMalicious, setSuspectedMalicious] = useState(false);
  const [supplierOrigin, setSupplierOrigin] = useState(false);
  const [personalData, setPersonalData] = useState(false);
  const [protectedInfo, setProtectedInfo] = useState(false);
  const [systemIds, setSystemIds] = useState<string[]>([]);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [vendorIds, setVendorIds] = useState<string[]>([]);

  function toggle(setter: React.Dispatch<React.SetStateAction<string[]>>, id: string) {
    setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          title,
          description: description || undefined,
          severity,
          incidentType: incidentType || undefined,
          suspectedMalicious,
          supplierOrigin,
          personalDataPossiblyAffected: personalData,
          protectedInformationPossiblyAffected: protectedInfo,
          incidentStartedAt: startedAt ? new Date(startedAt).toISOString() : undefined,
          systemIds,
          criticalServiceIds: serviceIds,
          vendorIds,
        }),
      });
      if (!res.ok) {
        setError("Kunde inte skapa incidenten.");
        return;
      }
      const body = await res.json();
      router.push(`/app/incidents/${body.data.id}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-5 rounded-xl border bg-card p-5">
      <h2 className="text-lg font-semibold">Registrera ny incident</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="i-title">Vad har hänt? *</Label>
          <Input
            id="i-title"
            required
            placeholder="ex. Dricksvattenstyrning otillgänglig"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="i-desc">Beskrivning</Label>
          <Textarea
            id="i-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="i-sev">Allvarlighet</Label>
          <select
            id="i-sev"
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            <option value="low">Låg</option>
            <option value="medium">Medel</option>
            <option value="high">Hög</option>
            <option value="critical">Kritisk</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="i-type">Typ</Label>
          <select
            id="i-type"
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
            value={incidentType}
            onChange={(e) => setIncidentType(e.target.value)}
          >
            <option value="">Välj typ…</option>
            <option value="outage">Driftavbrott</option>
            <option value="ransomware">Ransomware</option>
            <option value="data_leak">Dataläcka</option>
            <option value="ot_incident">OT/SCADA-incident</option>
            <option value="supplier">Leverantörsincident</option>
            <option value="ddos">Överbelastningsattack</option>
            <option value="other">Övrigt</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="i-start">När började incidenten?</Label>
          <Input
            id="i-start"
            type="datetime-local"
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
          />
        </div>
      </div>

      <fieldset className="grid gap-1 text-sm sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium">Tidiga indikationer</legend>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={suspectedMalicious}
            onChange={(e) => setSuspectedMalicious(e.target.checked)}
          />
          Misstänkt antagonistisk/olaglig handling
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={supplierOrigin}
            onChange={(e) => setSupplierOrigin(e.target.checked)}
          />
          Incidenten kommer från leverantör
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={personalData}
            onChange={(e) => setPersonalData(e.target.checked)}
          />
          Personuppgifter kan vara berörda (GDPR-spår startas)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={protectedInfo}
            onChange={(e) => setProtectedInfo(e.target.checked)}
          />
          Skyddad information kan vara berörd
        </label>
      </fieldset>

      {systems.length > 0 ? (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Påverkade system</legend>
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {systems.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={systemIds.includes(s.id)}
                  onChange={() => toggle(setSystemIds, s.id)}
                />
                {s.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {services.length > 0 ? (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Påverkade kritiska tjänster</legend>
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={serviceIds.includes(s.id)}
                  onChange={() => toggle(setServiceIds, s.id)}
                />
                {s.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {vendors.length > 0 ? (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Berörda leverantörer</legend>
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {vendors.map((v) => (
              <label key={v.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={vendorIds.includes(v.id)}
                  onChange={() => toggle(setVendorIds, v.id)}
                />
                {v.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={busy}>
        {busy ? "Skapar…" : "Skapa incident"}
      </Button>
    </form>
  );
}
