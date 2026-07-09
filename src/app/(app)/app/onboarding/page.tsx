import { redirect } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { DecisionSupportDisclaimer } from "@/components/app/disclaimer";
import { getCurrentTenant } from "@/lib/services/current-tenant";
import {
  getTenantControlPlaneClient,
  getTenantDataPlaneClient,
} from "@/lib/server/data-plane";
import { computeReadiness } from "@/lib/services/readiness";

import { OnboardingWizard } from "./wizard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kom igång" };

export default async function OnboardingPage() {
  const current = await getCurrentTenant();
  if (!current) redirect("/login");
  const { tenant } = current;

  const control = getTenantControlPlaneClient();
  const plane = await getTenantDataPlaneClient(tenant.id);

  const [
    stepsRes,
    progressRes,
    sectorsRes,
    subsectorsRes,
    sizeRes,
    settingsRes,
    legalEntitiesRes,
    systemsCountRes,
    servicesCountRes,
    vendorsCountRes,
    assignmentsRes,
    readiness,
  ] = await Promise.all([
    control.from("onboarding_steps").select("*").order("sort_order"),
    control.from("onboarding_progress").select("*").eq("tenant_id", tenant.id),
    control.from("sectors").select("code, name_sv, annex").order("name_sv"),
    control.from("subsectors").select("code, sector_code, name_sv").order("name_sv"),
    plane
      .from("entity_size_assessments")
      .select("size_class, employees, created_at")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    control
      .from("tenant_settings")
      .select(
        "incident_contact_name, incident_contact_email, reporting_contact_name, reporting_contact_email, management_owner_name, dpo_contact_name, dpo_contact_email, sso_required_preference, data_residency_requirement, deployment_model_preference",
      )
      .eq("tenant_id", tenant.id)
      .maybeSingle(),
    plane
      .from("legal_entities")
      .select("id, name, organization_number")
      .eq("tenant_id", tenant.id)
      .order("name"),
    plane
      .from("systems")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .is("deleted_at", null),
    plane
      .from("critical_services")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .is("deleted_at", null),
    plane
      .from("vendors")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .is("deleted_at", null),
    control
      .from("role_assignments")
      .select("roles(code)")
      .eq("tenant_id", tenant.id)
      .eq("status", "active"),
    computeReadiness(tenant.id),
  ]);

  type RoleRow = { roles: { code: string } | null };
  const assignedRoles = [
    ...new Set(
      ((assignmentsRes.data ?? []) as unknown as RoleRow[])
        .map((r) => r.roles?.code)
        .filter((c): c is string => Boolean(c)),
    ),
  ];

  return (
    <main className="p-8">
      <PageHeader
        title="Kom igång med Säkerhetsklar"
        description="Steg för steg: organisation, storlek, sektorer och regelprofil. Du kan pausa när som helst."
      />
      <div className="mb-6">
        <DecisionSupportDisclaimer />
      </div>
      <OnboardingWizard
        tenantId={tenant.id}
        tenantName={tenant.name}
        organizationNumber={tenant.organization_number}
        steps={(stepsRes.data ?? []).map((s) => ({
          key: s.step_key,
          title: s.title_sv,
          description: s.description_sv,
        }))}
        progress={Object.fromEntries(
          (progressRes.data ?? []).map((p) => [p.step_key, p.status]),
        )}
        sectors={sectorsRes.data ?? []}
        subsectors={subsectorsRes.data ?? []}
        latestSizeClass={sizeRes.data?.size_class ?? null}
        contacts={settingsRes.data ?? null}
        legalEntities={legalEntitiesRes.data ?? []}
        counts={{
          systems: systemsCountRes.count ?? 0,
          criticalServices: servicesCountRes.count ?? 0,
          vendors: vendorsCountRes.count ?? 0,
        }}
        assignedRoles={assignedRoles}
        readinessScore={readiness.nis2Readiness}
      />
    </main>
  );
}
