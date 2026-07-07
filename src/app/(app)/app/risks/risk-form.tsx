"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RiskForm({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [likelihood, setLikelihood] = useState("3");
  const [impact, setImpact] = useState("3");
  const [ownerName, setOwnerName] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          title,
          category: category || undefined,
          likelihood: Number(likelihood),
          impact: Number(impact),
          ownerName: ownerName || undefined,
        }),
      });
      if (!res.ok) {
        setError("Kunde inte skapa risken.");
        return;
      }
      setTitle("");
      setCategory("");
      setOwnerName("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4 rounded-xl border bg-card p-5">
      <h2 className="text-lg font-semibold">Lägg till risk</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="r-title">Titel *</Label>
          <Input id="r-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="r-cat">Kategori</Label>
          <Input
            id="r-cat"
            placeholder="ex. leverantör, tillgänglighet"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="r-owner">Riskägare</Label>
          <Input id="r-owner" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="r-like">Sannolikhet (1–5)</Label>
          <Input
            id="r-like"
            type="number"
            min={1}
            max={5}
            value={likelihood}
            onChange={(e) => setLikelihood(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="r-imp">Konsekvens (1–5)</Label>
          <Input
            id="r-imp"
            type="number"
            min={1}
            max={5}
            value={impact}
            onChange={(e) => setImpact(e.target.value)}
          />
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={busy}>
        {busy ? "Sparar…" : "Skapa risk"}
      </Button>
    </form>
  );
}
