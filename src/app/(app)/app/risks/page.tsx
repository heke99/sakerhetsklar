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
import { getCurrentTenant } from "@/lib/services/current-tenant";
import { RISK_STATUS_SV, svLabel } from "@/lib/labels/sv";
import { getAdminClient } from "@/lib/server/supabase-admin";

import { RiskForm } from "./risk-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Risker" };

export default async function RisksPage() {
  const current = await getCurrentTenant();
  if (!current) redirect("/login");
  const { tenant } = current;

  const admin = getAdminClient();
  const { data: risks } = await admin
    .from("risks")
    .select("*")
    .eq("tenant_id", tenant.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return (
    <main className="p-8">
      <PageHeader
        title="Risker"
        description="Riskregister med sannolikhet, konsekvens, ägare och åtgärdsstatus."
      />

      <div className="mb-8 rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Risk</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>S × K</TableHead>
              <TableHead>Nivå</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ägare</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(risks ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  Inga risker registrerade ännu.
                </TableCell>
              </TableRow>
            ) : (
              (risks ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell>{r.category ?? "–"}</TableCell>
                  <TableCell>
                    {r.likelihood ?? "–"} × {r.impact ?? "–"}
                  </TableCell>
                  <TableCell>
                    {r.risk_level ? (
                      <StatusBadge
                        color={
                          r.risk_level === "critical" || r.risk_level === "high"
                            ? "red"
                            : r.risk_level === "medium"
                              ? "yellow"
                              : "green"
                        }
                      >
                        {r.risk_level}
                      </StatusBadge>
                    ) : (
                      "–"
                    )}
                  </TableCell>
                  <TableCell>{svLabel(RISK_STATUS_SV, r.status)}</TableCell>
                  <TableCell>{r.owner_name ?? "–"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <RiskForm tenantId={tenant.id} />
    </main>
  );
}
