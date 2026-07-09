"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

const STATUS_LABELS: Record<string, string> = {
  requested: "Begärd",
  approved: "Godkänd",
  denied: "Nekad",
  revoked: "Återkallad",
  expired: "Utgången",
};

export function supportStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/**
 * Tenant-side decision buttons for a support-access request. Approve/deny is
 * a tenant admin/CISO decision; revocation requires a reason. All decisions
 * are audited server-side.
 */
export function SupportAccessActions({
  requestId,
  status,
  canDecide,
}: {
  requestId: string;
  status: string;
  canDecide: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "deny" | "revoke") {
    let reason: string | undefined;
    if (action === "deny" || action === "revoke") {
      const input = window.prompt(
        action === "deny"
          ? "Ange skäl för att neka supportåtkomsten:"
          : "Ange skäl för att återkalla supportåtkomsten:",
      );
      if (!input) return;
      reason = input;
    } else if (
      !window.confirm(
        "Godkänn supportåtkomsten? Åtkomsten är tidsbegränsad och all användning loggas.",
      )
    ) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/support-access/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(reason ? { reason } : {}) }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        setError(body.error?.message ?? "Åtgärden misslyckades.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!canDecide) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "requested" ? (
        <>
          <Button size="sm" disabled={busy} onClick={() => void act("approve")}>
            Godkänn
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void act("deny")}
          >
            Neka
          </Button>
        </>
      ) : null}
      {status === "approved" ? (
        <Button
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={() => void act("revoke")}
        >
          Återkalla
        </Button>
      ) : null}
      {error ? (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}
