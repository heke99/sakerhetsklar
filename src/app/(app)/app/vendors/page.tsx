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
import { getAdminClient } from "@/lib/server/supabase-admin";

import { VendorForm } from "./vendor-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leverantörer" };

export default async function VendorsPage() {
  const current = await getCurrentTenant();
  if (!current) redirect("/login");
  const { tenant } = current;

  const admin = getAdminClient();
  const { data: vendors } = await admin
    .from("vendors")
    .select("*, subcontractors(id)")
    .eq("tenant_id", tenant.id)
    .is("deleted_at", null)
    .order("name");

  const missingIncidentContact = (vendors ?? []).filter(
    (v) => !v.incident_contact_name && !v.incident_contact_email,
  ).length;

  return (
    <main className="p-8">
      <PageHeader
        title="Leverantörer"
        description="Leverantörsregister med incidentkontakter, avtal, underleverantörer och riskbedömning."
      />

      {missingIncidentContact > 0 ? (
        <p className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {missingIncidentContact} leverantör(er) saknar incidentkontakt. Vid en
          leverantörsincident behöver ni kunna nå leverantören snabbt.
        </p>
      ) : null}

      <div className="mb-8 rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Leverantör</TableHead>
              <TableHead>Org.nr</TableHead>
              <TableHead>Incidentkontakt</TableHead>
              <TableHead>24/7</TableHead>
              <TableHead>PUB-avtal</TableHead>
              <TableHead>Underleverantörer</TableHead>
              <TableHead>Risk</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(vendors ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  Inga leverantörer registrerade ännu.
                </TableCell>
              </TableRow>
            ) : (
              (vendors ?? []).map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell>{v.organization_number ?? "–"}</TableCell>
                  <TableCell>
                    {v.incident_contact_name || v.incident_contact_email ? (
                      <span className="text-sm">
                        {v.incident_contact_name ?? v.incident_contact_email}
                      </span>
                    ) : (
                      <StatusBadge color="yellow">Saknas</StatusBadge>
                    )}
                  </TableCell>
                  <TableCell>{v.has_24_7_contact ? "Ja" : "Nej"}</TableCell>
                  <TableCell>
                    {v.dpa_exists === true ? "Ja" : v.dpa_exists === false ? (
                      <StatusBadge color="yellow">Nej</StatusBadge>
                    ) : (
                      "–"
                    )}
                  </TableCell>
                  <TableCell>{((v.subcontractors as { id: string }[]) ?? []).length}</TableCell>
                  <TableCell>
                    {v.risk_rating ? (
                      <StatusBadge
                        color={
                          v.risk_rating === "critical" || v.risk_rating === "high"
                            ? "red"
                            : v.risk_rating === "medium"
                              ? "yellow"
                              : "green"
                        }
                      >
                        {v.risk_rating}
                      </StatusBadge>
                    ) : (
                      "–"
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <VendorForm tenantId={tenant.id} />
    </main>
  );
}
