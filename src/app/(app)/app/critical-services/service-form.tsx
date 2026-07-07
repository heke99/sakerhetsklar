"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CriticalServiceForm({
  tenantId,
  systems,
  sectors,
}: {
  tenantId: string;
  systems: { id: string; name: string }[];
  sectors: { code: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [sectorCode, setSectorCode] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [isExternal, setIsExternal] = useState(true);
  const [rto, setRto] = useState("");
  const [workaround, setWorkaround] = useState(false);
  const [workaroundMax, setWorkaroundMax] = useState("");
  const [systemIds, setSystemIds] = useState<string[]>([]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/critical-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          name,
          sectorCode: sectorCode || undefined,
          serviceOwnerName: ownerName || undefined,
          isExternal,
          rtoHours: rto ? Number(rto) : undefined,
          manualWorkaroundAvailable: workaround,
          manualWorkaroundMaxHours: workaroundMax ? Number(workaroundMax) : undefined,
          systemIds,
        }),
      });
      if (!res.ok) {
        setError("Kunde inte skapa tjänsten.");
        return;
      }
      setName("");
      setOwnerName("");
      setRto("");
      setWorkaroundMax("");
      setSystemIds([]);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4 rounded-xl border bg-card p-5">
      <h2 className="text-lg font-semibold">Lägg till kritisk tjänst</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cs-name">Namn *</Label>
          <Input id="cs-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cs-sector">Sektor</Label>
          <select
            id="cs-sector"
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
            value={sectorCode}
            onChange={(e) => setSectorCode(e.target.value)}
          >
            <option value="">Välj sektor…</option>
            {sectors.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cs-owner">Tjänsteägare</Label>
          <Input id="cs-owner" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cs-rto">RTO (timmar)</Label>
          <Input id="cs-rto" type="number" min={0} step="0.5" value={rto} onChange={(e) => setRto(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isExternal}
            onChange={(e) => setIsExternal(e.target.checked)}
          />
          Extern tjänst (mot kunder/mottagare)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={workaround}
            onChange={(e) => setWorkaround(e.target.checked)}
          />
          Manuell reservrutin finns
        </label>
        {workaround ? (
          <span className="flex items-center gap-2">
            <Label htmlFor="cs-wmax">Max varaktighet (h)</Label>
            <Input
              id="cs-wmax"
              type="number"
              min={0}
              step="0.5"
              className="w-24"
              value={workaroundMax}
              onChange={(e) => setWorkaroundMax(e.target.value)}
            />
          </span>
        ) : null}
      </div>

      {systems.length > 0 ? (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Kopplade system</legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {systems.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={systemIds.includes(s.id)}
                  onChange={() =>
                    setSystemIds((prev) =>
                      prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id],
                    )
                  }
                />
                {s.name}
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
        {busy ? "Sparar…" : "Skapa tjänst"}
      </Button>
    </form>
  );
}
