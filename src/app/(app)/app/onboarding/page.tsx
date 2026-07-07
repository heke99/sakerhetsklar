import { redirect } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { DecisionSupportDisclaimer } from "@/components/app/disclaimer";
import { getCurrentTenant } from "@/lib/services/current-tenant";
import { getAdminClient } from "@/lib/server/supabase-admin";

import { OnboardingWizard } from "./wizard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kom igång" };

export default async function OnboardingPage() {
  const current = await getCurrentTenant();
  if (!current) redirect("/login");
  const { tenant } = current;

  const admin = getAdminClient();
  const [stepsRes, progressRes, sectorsRes, subsectorsRes, sizeRes] = await Promise.all([
    admin.from("onboarding_steps").select("*").order("sort_order"),
    admin.from("onboarding_progress").select("*").eq("tenant_id", tenant.id),
    admin.from("sectors").select("code, name_sv, annex").order("name_sv"),
    admin.from("subsectors").select("code, sector_code, name_sv").order("name_sv"),
    admin
      .from("entity_size_assessments")
      .select("size_class, employees, created_at")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

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
      />
    </main>
  );
}
