import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { DecisionSupportDisclaimer } from "@/components/app/disclaimer";
import { getCurrentTenant } from "@/lib/services/current-tenant";
import {
  getTenantControlPlaneClient,
  getTenantDataPlaneClient,
} from "@/lib/server/data-plane";

import { GdprForm } from "./gdpr-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "GDPR-spår" };

export default async function GdprTrackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const current = await getCurrentTenant();
  if (!current) redirect("/login");
  const { tenant } = current;
  const { id } = await params;

  const admin = await getTenantDataPlaneClient(tenant.id);
  const control = getTenantControlPlaneClient();
  const [incidentRes, assessmentRes, trackRes] = await Promise.all([
    admin
      .from("incidents")
      .select("id, reference, title")
      .eq("id", id)
      .eq("tenant_id", tenant.id)
      .maybeSingle(),
    admin
      .from("incident_personal_data_assessments")
      .select("*")
      .eq("incident_id", id)
      .eq("tenant_id", tenant.id)
      .maybeSingle(),
    // Legal description is data-driven: the GDPR/IMY track text (incl. the
    // 72-hour rule) comes from the versioned rule registry, not the frontend.
    control
      .from("regulatory_tracks")
      .select("description_sv, authority")
      .eq("code", "GDPR_IMY")
      .maybeSingle(),
  ]);

  const incident = incidentRes.data;
  if (!incident) notFound();

  const trackDescription =
    trackRes.data?.description_sv ??
    "Personuppgiftsincidentbedömning enligt GDPR. Tidsfrister avgörs av regelverket — kontrollera regelprofilen.";

  return (
    <main className="p-8">
      <PageHeader
        title={`GDPR-spår — ${incident.reference}`}
        description={`${trackDescription} GDPR-bedömningen är separat från NIS2-rapporteringen.`}
      />
      <div className="mb-6">
        <DecisionSupportDisclaimer />
      </div>

      <GdprForm
        tenantId={tenant.id}
        incidentId={incident.id}
        assessment={assessmentRes.data}
      />

      <p className="mt-6 text-sm">
        <Link href={`/app/incidents/${incident.id}`} className="text-primary hover:underline">
          ← Tillbaka till incidenten
        </Link>
      </p>
    </main>
  );
}
