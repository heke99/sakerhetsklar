import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { DecisionSupportDisclaimer } from "@/components/app/disclaimer";
import { getCurrentTenant } from "@/lib/services/current-tenant";
import { getAdminClient } from "@/lib/server/supabase-admin";

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

  const admin = getAdminClient();
  const [incidentRes, assessmentRes] = await Promise.all([
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
      .maybeSingle(),
  ]);

  const incident = incidentRes.data;
  if (!incident) notFound();

  return (
    <main className="p-8">
      <PageHeader
        title={`GDPR-spår — ${incident.reference}`}
        description="Personuppgiftsincidentbedömning enligt GDPR. Anmälan till IMY görs normalt inom 72 timmar från kännedom om anmälningspliktig incident. GDPR-bedömningen är separat från NIS2-rapporteringen."
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
