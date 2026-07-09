import { redirect } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TENANT_ROLE_LABELS_SV, type TenantRole } from "@/lib/authz/roles";
import { hasTenantRole } from "@/lib/authz/context";
import { getCurrentTenant } from "@/lib/services/current-tenant";
import { getAdminClient } from "@/lib/server/supabase-admin";

import { BreakGlassControls } from "./break-glass-controls";
import {
  SupportAccessActions,
  supportStatusLabel,
} from "./support-access-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Åtkomstgranskning" };

export default async function AccessReviewPage() {
  const current = await getCurrentTenant();
  if (!current) redirect("/login");
  const { tenant, actor } = current;
  const canDecideSupport = hasTenantRole(actor, tenant.id, ["tenant_admin", "ciso"]);

  const admin = getAdminClient();
  const [membersRes, assignmentsRes, breakGlassRes, anomaliesRes, supportRes] =
    await Promise.all([
      admin
        .from("tenant_memberships")
        .select("user_id, profiles:user_id(full_name, email)")
        .eq("tenant_id", tenant.id)
        .eq("status", "active"),
      admin
        .from("role_assignments")
        .select("user_id, roles(code)")
        .eq("tenant_id", tenant.id)
        .eq("status", "active"),
      admin
        .from("break_glass_sessions")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("started_at", { ascending: false })
        .limit(20),
      admin
        .from("security_anomaly_events")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("detected_at", { ascending: false })
        .limit(20),
      admin
        .from("support_access_requests")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  type AssignmentRow = { user_id: string; roles: { code: string } | null };
  const rolesByUser = new Map<string, string[]>();
  for (const a of (assignmentsRes.data ?? []) as unknown as AssignmentRow[]) {
    if (!a.roles) continue;
    const list = rolesByUser.get(a.user_id) ?? [];
    list.push(a.roles.code);
    rolesByUser.set(a.user_id, list);
  }

  type MemberRow = {
    user_id: string;
    profiles: { full_name: string | null; email: string | null } | null;
  };

  return (
    <main className="p-8">
      <PageHeader
        title="Åtkomstgranskning"
        description="Vem har åtkomst till vad: roller, supportåtkomst, break-glass och säkerhetsavvikelser. Underlag för exporterbar åtkomstgranskningsrapport."
      />

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Användare och roller</h2>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Användare</TableHead>
                <TableHead>Roller</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {((membersRes.data ?? []) as unknown as MemberRow[]).map((m) => (
                <TableRow key={m.user_id}>
                  <TableCell>
                    {m.profiles?.full_name ?? m.profiles?.email ?? m.user_id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="space-x-1">
                    {(rolesByUser.get(m.user_id) ?? []).map((code) => (
                      <StatusBadge key={code} color="blue">
                        {TENANT_ROLE_LABELS_SV[code as TenantRole] ?? code}
                      </StatusBadge>
                    ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Supportåtkomst</h2>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Syfte</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Gäller till</TableHead>
                <TableHead>Beslut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(supportRes.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    Inga supportåtkomstförfrågningar.
                  </TableCell>
                </TableRow>
              ) : (
                (supportRes.data ?? []).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="max-w-md truncate">{s.purpose}</TableCell>
                    <TableCell>
                      <StatusBadge
                        color={
                          s.status === "approved"
                            ? "yellow"
                            : s.status === "requested"
                              ? "blue"
                              : "gray"
                        }
                      >
                        {supportStatusLabel(s.status)}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      {s.expires_at ? new Date(s.expires_at).toLocaleString("sv-SE") : "–"}
                    </TableCell>
                    <TableCell>
                      <SupportAccessActions
                        requestId={s.id}
                        status={s.status}
                        canDecide={canDecideSupport}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <BreakGlassControls
        tenantId={tenant.id}
        sessions={(breakGlassRes.data ?? []).map((b) => ({
          id: b.id,
          reason: b.reason,
          scope: b.scope,
          status: b.status,
          startedAt: b.started_at,
          expiresAt: b.expires_at,
        }))}
      />

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Säkerhetsavvikelser</h2>
        <div className="rounded-xl border bg-card p-4 text-sm">
          {(anomaliesRes.data ?? []).length === 0 ? (
            <p className="text-muted-foreground">Inga säkerhetsavvikelser upptäckta.</p>
          ) : (
            <ul className="space-y-2">
              {(anomaliesRes.data ?? []).map((a) => (
                <li key={a.id} className="flex items-center gap-2">
                  <StatusBadge color={a.severity === "critical" ? "red" : "yellow"}>
                    {a.rule_code}
                  </StatusBadge>
                  <span>{a.detail}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(a.detected_at).toLocaleString("sv-SE")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
