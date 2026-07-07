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

import { SystemForm, SystemImport } from "./system-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "System" };

export default async function SystemsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const current = await getCurrentTenant();
  if (!current) redirect("/login");
  const { tenant } = current;
  const { filter } = await searchParams;

  const admin = getAdminClient();
  const { data: systems } = await admin
    .from("systems")
    .select("*")
    .eq("tenant_id", tenant.id)
    .is("deleted_at", null)
    .order("name");

  let list = systems ?? [];
  if (filter === "missing-owner") list = list.filter((s) => !s.owner_name && !s.owner_user_id);
  if (filter === "missing-rto") list = list.filter((s) => s.rto_hours === null || s.rpo_hours === null);

  const missingOwner = (systems ?? []).filter((s) => !s.owner_name && !s.owner_user_id).length;
  const missingRto = (systems ?? []).filter((s) => s.rto_hours === null || s.rpo_hours === null).length;

  return (
    <main className="p-8">
      <PageHeader
        title="System"
        description="Digital miljö: system, ägare, RTO/RPO, backup och status. Incidenter kopplas till system härifrån."
      />

      <div className="mb-6 flex flex-wrap gap-3">
        {missingOwner > 0 ? (
          <a
            href="/app/systems?filter=missing-owner"
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
          >
            {missingOwner} system saknar ägare — åtgärda
          </a>
        ) : null}
        {missingRto > 0 ? (
          <a
            href="/app/systems?filter=missing-rto"
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
          >
            {missingRto} system saknar RTO/RPO — åtgärda
          </a>
        ) : null}
      </div>

      <div className="mb-8 rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>System</TableHead>
              <TableHead>Miljö</TableHead>
              <TableHead>Ägare</TableHead>
              <TableHead>Sektorskritiskt</TableHead>
              <TableHead>RTO/RPO (h)</TableHead>
              <TableHead>Backup</TableHead>
              <TableHead>Risk</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  Inga system registrerade. Skapa manuellt eller importera från Excel nedan.
                </TableCell>
              </TableRow>
            ) : (
              list.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.system_type ?? ""}</p>
                  </TableCell>
                  <TableCell>{s.environment}</TableCell>
                  <TableCell>
                    {s.owner_name ?? (
                      <StatusBadge color="yellow">Ägare saknas</StatusBadge>
                    )}
                  </TableCell>
                  <TableCell>
                    {s.sector_critical ? <StatusBadge color="red">Ja</StatusBadge> : "Nej"}
                  </TableCell>
                  <TableCell>
                    {s.rto_hours ?? "–"} / {s.rpo_hours ?? "–"}
                  </TableCell>
                  <TableCell>
                    {s.backup_status ? (
                      <StatusBadge
                        color={
                          s.backup_status === "ok"
                            ? "green"
                            : s.backup_status === "missing"
                              ? "red"
                              : "yellow"
                        }
                      >
                        {s.backup_status}
                      </StatusBadge>
                    ) : (
                      "–"
                    )}
                  </TableCell>
                  <TableCell>
                    {s.risk_rating ? (
                      <StatusBadge
                        color={
                          s.risk_rating === "critical" || s.risk_rating === "high"
                            ? "red"
                            : s.risk_rating === "medium"
                              ? "yellow"
                              : "green"
                        }
                      >
                        {s.risk_rating}
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

      <div className="grid gap-6 lg:grid-cols-2">
        <SystemForm tenantId={tenant.id} />
        <SystemImport tenantId={tenant.id} />
      </div>
    </main>
  );
}
