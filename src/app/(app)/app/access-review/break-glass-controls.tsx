"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/app/status-badge";

interface Session {
  id: string;
  reason: string;
  scope: string;
  status: string;
  startedAt: string;
  expiresAt: string;
}

export function BreakGlassControls({
  tenantId,
  sessions,
}: {
  tenantId: string;
  sessions: Session[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/security/break-glass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, reason, scope: "tenant_read", durationMinutes: 60 }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? "Kunde inte starta break-glass.");
        return;
      }
      setReason("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function end(sessionId: string) {
    if (!window.confirm("Avsluta break-glass-sessionen? Åtgärden loggas.")) {
      return;
    }
    setBusy(true);
    try {
      await fetch("/api/v1/security/break-glass", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Break-glass (nödåtkomst)</h2>
      <div className="rounded-xl border bg-card p-5">
        <p className="mb-4 text-sm text-muted-foreground">
          Nödåtkomst kräver skäl, är tidsbegränsad (60 min), loggas fullständigt
          och notifierar organisationsadministratörer och CISO.
        </p>

        <ul className="mb-4 space-y-2 text-sm">
          {sessions.length === 0 ? (
            <li className="text-muted-foreground">Inga break-glass-sessioner.</li>
          ) : (
            sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
                <StatusBadge color={s.status === "active" ? "red" : "gray"}>
                  {s.status}
                </StatusBadge>
                <span className="min-w-0 flex-1 truncate">{s.reason}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(s.startedAt).toLocaleString("sv-SE")} →{" "}
                  {new Date(s.expiresAt).toLocaleString("sv-SE")}
                </span>
                {s.status === "active" ? (
                  <Button size="xs" variant="destructive" onClick={() => end(s.id)} disabled={busy}>
                    Avsluta
                  </Button>
                ) : null}
              </li>
            ))
          )}
        </ul>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1 space-y-1.5">
            <Label htmlFor="bg-reason">Skäl för nödåtkomst (minst 10 tecken)</Label>
            <Input
              id="bg-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="ex. incidentansvarig otillgänglig under pågående allvarlig incident"
            />
          </div>
          <Button onClick={start} disabled={busy || reason.length < 10} variant="destructive">
            Starta break-glass
          </Button>
        </div>
        {error ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
