import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { DecisionSupportDisclaimer } from "@/components/app/disclaimer";
import { getCurrentTenant } from "@/lib/services/current-tenant";
import { getAdminClient } from "@/lib/server/supabase-admin";

import { LateReportingForm } from "./late-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sen rapportering" };

export default async function LateReportingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const current = await getCurrentTenant();
  if (!current) redirect("/login");
  const { tenant } = current;
  const { id } = await params;

  const admin = getAdminClient();
  const [incidentRes, recordsRes] = await Promise.all([
    admin
      .from("incidents")
      .select("id, reference, title")
      .eq("id", id)
      .eq("tenant_id", tenant.id)
      .maybeSingle(),
    admin
      .from("late_reporting_records")
      .select("*")
      .eq("incident_id", id)
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false }),
  ]);

  const incident = incidentRes.data;
  if (!incident) notFound();

  return (
    <main className="p-8">
      <PageHeader
        title={`Sen rapportering — ${incident.reference}`}
        description="En rapporteringsdeadline har missats. Dokumentera orsaker, skapa förklaringsutkast och låt ledningen godkänna. Försenad rapportering kan utgöra en allvarlig överträdelse och medföra tillsynsåtgärder — dokumentationen nedan är en del av åtgärdsplanen."
      />
      <div className="mb-6">
        <DecisionSupportDisclaimer />
      </div>

      {(recordsRes.data ?? []).length === 0 ? (
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          Inga sena rapporteringar registrerade för denna incident.
        </div>
      ) : (
        <div className="space-y-6">
          {(recordsRes.data ?? []).map((r) => (
            <LateReportingForm key={r.id} tenantId={tenant.id} incidentId={incident.id} record={r} />
          ))}
        </div>
      )}

      <p className="mt-6 text-sm">
        <Link href={`/app/incidents/${incident.id}`} className="text-primary hover:underline">
          ← Tillbaka till incidenten
        </Link>
      </p>
    </main>
  );
}
