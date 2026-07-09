import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { DecisionSupportDisclaimer } from "@/components/app/disclaimer";
import { StatusBadge, type StatusColor } from "@/components/app/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentTenant } from "@/lib/services/current-tenant";
import { INCIDENT_STATUS_SV, SEVERITY_SV, svLabel } from "@/lib/labels/sv";
import { getAdminClient } from "@/lib/server/supabase-admin";

import { IncidentWizard } from "./incident-wizard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Incidenter" };

const statusColors: Record<string, StatusColor> = {
  new: "blue",
  triage: "yellow",
  investigating: "yellow",
  contained: "blue",
  resolved: "green",
  closed: "gray",
};

const significanceColors: Record<string, StatusColor> = {
  not_assessed: "gray",
  assessment_in_progress: "blue",
  not_reportable: "green",
  monitor: "yellow",
  potentially_significant: "yellow",
  significant_reportable: "red",
  manual_review_required: "purple",
};

const significanceLabels: Record<string, string> = {
  not_assessed: "Ej bedömd",
  assessment_in_progress: "Bedömning pågår",
  not_reportable: "Ej rapporteringspliktig",
  monitor: "Bevaka",
  potentially_significant: "Potentiellt betydande",
  significant_reportable: "Betydande — rapporteringspliktig",
  manual_review_required: "Manuell bedömning krävs",
};

export default async function IncidentsPage() {
  const current = await getCurrentTenant();
  if (!current) redirect("/login");
  const { tenant } = current;

  const admin = getAdminClient();
  const [incidentsRes, systemsRes, servicesRes, vendorsRes] = await Promise.all([
    admin
      .from("incidents")
      .select("*")
      .eq("tenant_id", tenant.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    admin
      .from("systems")
      .select("id, name")
      .eq("tenant_id", tenant.id)
      .is("deleted_at", null)
      .order("name"),
    admin
      .from("critical_services")
      .select("id, name")
      .eq("tenant_id", tenant.id)
      .is("deleted_at", null)
      .order("name"),
    admin
      .from("vendors")
      .select("id, name")
      .eq("tenant_id", tenant.id)
      .is("deleted_at", null)
      .order("name"),
  ]);

  return (
    <main className="p-8">
      <PageHeader
        title="Incidenter"
        description="Operativ incidenthantering: tidslinje, påverkan, bedömning och rapportering."
      />
      <div className="mb-6">
        <DecisionSupportDisclaimer />
      </div>

      <div className="mb-8 rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Referens</TableHead>
              <TableHead>Titel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Allvarlighet</TableHead>
              <TableHead>Rapporteringsstatus</TableHead>
              <TableHead>Skapad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(incidentsRes.data ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  Inga incidenter registrerade.
                </TableCell>
              </TableRow>
            ) : (
              (incidentsRes.data ?? []).map((i) => (
                <TableRow key={i.id}>
                  <TableCell>
                    <Link
                      href={`/app/incidents/${i.id}`}
                      className="font-mono text-sm font-medium text-primary hover:underline"
                    >
                      {i.reference}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-sm truncate font-medium">{i.title}</TableCell>
                  <TableCell>
                    <StatusBadge color={statusColors[i.status] ?? "gray"}>{svLabel(INCIDENT_STATUS_SV, i.status)}</StatusBadge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      color={
                        i.severity === "critical" || i.severity === "high"
                          ? "red"
                          : i.severity === "medium"
                            ? "yellow"
                            : "green"
                      }
                    >
                      {svLabel(SEVERITY_SV, i.severity)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge color={significanceColors[i.significance_status] ?? "gray"}>
                      {significanceLabels[i.significance_status] ?? i.significance_status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>{new Date(i.created_at).toLocaleString("sv-SE")}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <IncidentWizard
        tenantId={tenant.id}
        systems={(systemsRes.data ?? []).map((s) => ({ id: s.id, name: s.name }))}
        services={(servicesRes.data ?? []).map((s) => ({ id: s.id, name: s.name }))}
        vendors={(vendorsRes.data ?? []).map((v) => ({ id: v.id, name: v.name }))}
      />
    </main>
  );
}
