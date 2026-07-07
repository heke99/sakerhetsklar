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

import { CriticalServiceForm } from "./service-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kritiska tjänster" };

export default async function CriticalServicesPage() {
  const current = await getCurrentTenant();
  if (!current) redirect("/login");
  const { tenant } = current;

  const admin = getAdminClient();
  const [servicesRes, systemsRes, sectorsRes] = await Promise.all([
    admin
      .from("critical_services")
      .select("*, critical_service_systems(system_id, systems(name))")
      .eq("tenant_id", tenant.id)
      .is("deleted_at", null)
      .order("name"),
    admin
      .from("systems")
      .select("id, name")
      .eq("tenant_id", tenant.id)
      .is("deleted_at", null)
      .order("name"),
    admin.from("sectors").select("code, name_sv").order("name_sv"),
  ]);

  return (
    <main className="p-8">
      <PageHeader
        title="Kritiska tjänster"
        description="Tjänster vars avbrott kan utlösa rapporteringsplikt. Koppla tjänster till system och ange RTO, reservrutiner och ägare."
      />

      <div className="mb-8 rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tjänst</TableHead>
              <TableHead>Sektor</TableHead>
              <TableHead>Extern</TableHead>
              <TableHead>Ägare</TableHead>
              <TableHead>RTO (h)</TableHead>
              <TableHead>Reservrutin</TableHead>
              <TableHead>Kopplade system</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(servicesRes.data ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  Inga kritiska tjänster registrerade ännu.
                </TableCell>
              </TableRow>
            ) : (
              (servicesRes.data ?? []).map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.sector_code ?? "–"}</TableCell>
                  <TableCell>{s.is_external ? "Ja" : "Nej"}</TableCell>
                  <TableCell>
                    {s.service_owner_name ?? <StatusBadge color="yellow">Saknas</StatusBadge>}
                  </TableCell>
                  <TableCell>{s.rto_hours ?? "–"}</TableCell>
                  <TableCell>
                    {s.manual_workaround_available === true
                      ? `Ja${s.manual_workaround_max_hours ? ` (max ${s.manual_workaround_max_hours} h)` : ""}`
                      : s.manual_workaround_available === false
                        ? "Nej"
                        : "–"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {((s.critical_service_systems as { systems: { name: string } | null }[]) ?? [])
                      .map((cs) => cs.systems?.name)
                      .filter(Boolean)
                      .join(", ") || "–"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CriticalServiceForm
        tenantId={tenant.id}
        systems={(systemsRes.data ?? []).map((s) => ({ id: s.id, name: s.name }))}
        sectors={(sectorsRes.data ?? []).map((s) => ({ code: s.code, name: s.name_sv }))}
      />
    </main>
  );
}
