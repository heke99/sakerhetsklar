"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PendingInvitation {
  id: string;
  email: string;
  roleCode: string;
  status: string;
  expiresAt: string;
}

/**
 * Platform-side tenant lifecycle actions: invite the first tenant admin,
 * resend/revoke invitations. Membership content stays operational metadata —
 * no tenant business data is shown here.
 */
export function TenantAdminActions({
  tenantId,
  invitations,
}: {
  tenantId: string;
  invitations: PendingInvitation[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function call(method: string, body: unknown) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/v1/tenants/${tenantId}/invitations`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: { inviteUrl?: string; emailDelivered?: boolean };
        error?: { message?: string };
      };
      if (!res.ok) {
        setError(json.error?.message ?? "Action failed.");
        return;
      }
      if (json.data?.inviteUrl) {
        setNotice(`Invitation created. Dev-only link: ${json.data.inviteUrl}`);
      } else if (json.data?.emailDelivered) {
        setNotice("Invitation e-mail sent.");
      } else {
        setNotice("Done.");
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void call("POST", { email, roleCode: "tenant_admin" }).then(() =>
            setEmail(""),
          );
        }}
      >
        <div className="min-w-64 flex-1 space-y-1">
          <Label htmlFor="admin-email">Tenant admin e-mail</Label>
          <Input
            id="admin-email"
            type="email"
            required
            placeholder="admin@customer.se"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={busy || !email}>
          {busy ? "Sending…" : "Invite tenant admin"}
        </Button>
      </form>

      {invitations.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {invitations.map((inv) => (
            <li
              key={inv.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
            >
              <span>
                {inv.email} — {inv.roleCode} ({inv.status}, expires{" "}
                {new Date(inv.expiresAt).toLocaleDateString("sv-SE")})
              </span>
              {inv.status === "pending" ? (
                <span className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void call("PATCH", { invitationId: inv.id, action: "resend" })
                    }
                  >
                    Resend
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void call("PATCH", { invitationId: inv.id, action: "revoke" })
                    }
                  >
                    Revoke
                  </Button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No invitations yet.</p>
      )}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="break-all text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
