"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/app/status-badge";
import {
  TENANT_ROLES,
  TENANT_ROLE_LABELS_SV,
  type TenantRole,
} from "@/lib/authz/roles";

export interface MemberItem {
  userId: string;
  fullName: string | null;
  email: string | null;
  roles: string[];
}

export interface InvitationItem {
  id: string;
  email: string;
  roleCode: string;
  expiresAt: string;
}

async function apiCall(
  url: string,
  method: string,
  body: unknown,
): Promise<{ ok: boolean; message?: string; data?: Record<string, unknown> }> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: Record<string, unknown>;
    error?: { message?: string };
  };
  return {
    ok: res.ok,
    message: json.error?.message,
    data: json.data,
  };
}

export function UserManagement({
  tenantId,
  currentUserId,
  members,
  invitations,
  canManage,
}: {
  tenantId: string;
  currentUserId: string;
  members: MemberItem[];
  invitations: InvitationItem[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [roleCode, setRoleCode] = useState<TenantRole>("incident_manager");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(action: () => Promise<{ ok: boolean; message?: string; data?: Record<string, unknown> }>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await action();
      if (!result.ok) {
        setError(result.message ?? "Åtgärden misslyckades. Försök igen.");
        return;
      }
      if (typeof result.data?.inviteUrl === "string") {
        setNotice(
          `Inbjudan skapad. Utvecklingsläge — länk: ${result.data.inviteUrl}`,
        );
      } else if (result.data?.emailDelivered === true) {
        setNotice("Inbjudan skickad via e-post.");
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      {canManage ? (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 text-lg font-semibold">Bjud in användare</h2>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() =>
                apiCall(`/api/v1/tenants/${tenantId}/invitations`, "POST", {
                  email,
                  roleCode,
                }),
              ).then(() => setEmail(""));
            }}
          >
            <div className="min-w-64 flex-1 space-y-1">
              <Label htmlFor="invite-email">E-postadress</Label>
              <Input
                id="invite-email"
                type="email"
                required
                placeholder="namn@organisation.se"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invite-role">Roll</Label>
              <select
                id="invite-role"
                value={roleCode}
                onChange={(e) => setRoleCode(e.target.value as TenantRole)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {TENANT_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {TENANT_ROLE_LABELS_SV[r]}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={busy || !email}>
              {busy ? "Skickar…" : "Skicka inbjudan"}
            </Button>
          </form>
          {error ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p role="status" className="mt-3 break-all text-sm text-emerald-700">
              {notice}
            </p>
          ) : null}
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Användare</h2>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Namn</TableHead>
                <TableHead>E-post</TableHead>
                <TableHead>Roller</TableHead>
                {canManage ? <TableHead>Åtgärder</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canManage ? 4 : 3}
                    className="text-muted-foreground"
                  >
                    Inga användare ännu. Bjud in den första användaren ovan.
                  </TableCell>
                </TableRow>
              ) : (
                members.map((m) => (
                  <TableRow key={m.userId}>
                    <TableCell>{m.fullName ?? "–"}</TableCell>
                    <TableCell>{m.email ?? "–"}</TableCell>
                    <TableCell className="space-x-1">
                      {m.roles.map((code) => (
                        <StatusBadge key={code} color="blue">
                          {TENANT_ROLE_LABELS_SV[code as TenantRole] ?? code}
                        </StatusBadge>
                      ))}
                    </TableCell>
                    {canManage ? (
                      <TableCell>
                        {m.userId === currentUserId ? (
                          <span className="text-xs text-muted-foreground">
                            Ditt konto
                          </span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="sr-only" htmlFor={`role-${m.userId}`}>
                              Ändra roll
                            </label>
                            <select
                              id={`role-${m.userId}`}
                              defaultValue=""
                              disabled={busy}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (!value) return;
                                void run(() =>
                                  apiCall(
                                    `/api/v1/tenants/${tenantId}/members`,
                                    "PATCH",
                                    {
                                      userId: m.userId,
                                      action: "set_role",
                                      roleCode: value,
                                    },
                                  ),
                                );
                              }}
                              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                            >
                              <option value="">Ändra roll…</option>
                              {TENANT_ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {TENANT_ROLE_LABELS_SV[r]}
                                </option>
                              ))}
                            </select>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => {
                                if (
                                  !window.confirm(
                                    `Vill du inaktivera åtkomsten för ${m.email ?? m.userId}? Användaren förlorar all åtkomst till organisationen.`,
                                  )
                                ) {
                                  return;
                                }
                                void run(() =>
                                  apiCall(
                                    `/api/v1/tenants/${tenantId}/members`,
                                    "PATCH",
                                    { userId: m.userId, action: "deactivate" },
                                  ),
                                );
                              }}
                            >
                              Inaktivera
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Väntande inbjudningar</h2>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>E-post</TableHead>
                <TableHead>Roll</TableHead>
                <TableHead>Giltig till</TableHead>
                {canManage ? <TableHead>Åtgärder</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canManage ? 4 : 3}
                    className="text-muted-foreground"
                  >
                    Inga väntande inbjudningar.
                  </TableCell>
                </TableRow>
              ) : (
                invitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{inv.email}</TableCell>
                    <TableCell>
                      {TENANT_ROLE_LABELS_SV[inv.roleCode as TenantRole] ??
                        inv.roleCode}
                    </TableCell>
                    <TableCell>
                      {new Date(inv.expiresAt).toLocaleDateString("sv-SE")}
                    </TableCell>
                    {canManage ? (
                      <TableCell className="space-x-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            void run(() =>
                              apiCall(
                                `/api/v1/tenants/${tenantId}/invitations`,
                                "PATCH",
                                { invitationId: inv.id, action: "resend" },
                              ),
                            )
                          }
                        >
                          Skicka igen
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Vill du återkalla inbjudan till ${inv.email}?`,
                              )
                            ) {
                              return;
                            }
                            void run(() =>
                              apiCall(
                                `/api/v1/tenants/${tenantId}/invitations`,
                                "PATCH",
                                { invitationId: inv.id, action: "revoke" },
                              ),
                            );
                          }}
                        >
                          Återkalla
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
