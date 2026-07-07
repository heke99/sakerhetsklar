import { redirect } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { DecisionSupportDisclaimer } from "@/components/app/disclaimer";
import { StatusBadge } from "@/components/app/status-badge";
import { coverageColor, ruleStatusColor } from "@/components/app/status-colors";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentTenant } from "@/lib/services/current-tenant";
import { getAdminClient } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Regelprofil" };

export default async function TenantRulesPage() {
  const current = await getCurrentTenant();
  if (!current) redirect("/login");
  const { tenant } = current;

  const admin = getAdminClient();
  const { data: assigned } = await admin
    .from("tenant_rule_package_versions")
    .select("rule_set_code, version, assigned_at")
    .eq("tenant_id", tenant.id)
    .eq("status", "active");

  const codes = (assigned ?? []).map((a) => a.rule_set_code);
  const { data: ruleSets } = codes.length
    ? await admin
        .from("regulatory_rule_sets")
        .select("*")
        .in("code", codes)
        .order("code")
    : { data: [] };

  return (
    <main className="p-8">
      <PageHeader
        title="Regelprofil"
        description="Regelpaket som gäller för er verksamhet, med status och täckning. Regler som inte är slutliga är markerade och kräver manuell bedömning."
      />
      <div className="mb-6">
        <DecisionSupportDisclaimer />
      </div>

      {(ruleSets ?? []).length === 0 ? (
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          Ingen regelprofil ännu. Genomför omfattningsbedömningen under Kom igång.
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Regelpaket</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Täckning</TableHead>
                <TableHead>Gäller från</TableHead>
                <TableHead>Version</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(ruleSets ?? []).map((rs) => (
                <TableRow key={rs.id}>
                  <TableCell>
                    <p className="font-medium">{rs.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{rs.code}</p>
                    {rs.manual_review_required ? (
                      <p className="mt-1 text-xs text-purple-700 dark:text-purple-300">
                        {rs.description_sv ?? "Manuell bedömning krävs."}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <StatusBadge color={ruleStatusColor(rs.status)}>{rs.status}</StatusBadge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge color={coverageColor(rs.coverage_status)}>
                      {rs.coverage_status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>{rs.effective_from ?? "–"}</TableCell>
                  <TableCell className="font-mono text-sm">{rs.version}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </main>
  );
}
