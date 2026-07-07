import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { DecisionSupportDisclaimer } from "@/components/app/disclaimer";
import { getCurrentTenant } from "@/lib/services/current-tenant";
import { getAdminClient } from "@/lib/server/supabase-admin";

import { AssessmentForm } from "./assessment-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Är incidenten betydande?" };

export default async function AssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const current = await getCurrentTenant();
  if (!current) redirect("/login");
  const { tenant } = current;
  const { id } = await params;

  const admin = getAdminClient();
  const [incidentRes, assessmentRes, scopeRes] = await Promise.all([
    admin
      .from("incidents")
      .select("id, reference, title, severity, significance_status")
      .eq("id", id)
      .eq("tenant_id", tenant.id)
      .maybeSingle(),
    admin
      .from("incident_significance_assessments")
      .select("*")
      .eq("incident_id", id)
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("scope_results")
      .select("sectors, classification")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const incident = incidentRes.data;
  if (!incident) notFound();

  return (
    <main className="p-8">
      <PageHeader
        title={`Är incidenten betydande? — ${incident.reference}`}
        description={`${incident.title}. Svara på frågorna nedan så bedömer regelmotorn incidenten mot era regelpaket.`}
      />
      <div className="mb-6">
        <DecisionSupportDisclaimer />
      </div>

      <AssessmentForm
        tenantId={tenant.id}
        incidentId={incident.id}
        sectors={(scopeRes.data?.sectors as string[] | undefined) ?? []}
        latestAssessment={assessmentRes.data}
      />
    </main>
  );
}
