import { redirect } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { getCurrentTenant } from "@/lib/services/current-tenant";
import { getAdminClient } from "@/lib/server/supabase-admin";

import { LathundList } from "./lathund-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Lathundar" };

export default async function LathundsPage() {
  const current = await getCurrentTenant();
  if (!current) redirect("/login");
  const { tenant } = current;

  const admin = getAdminClient();
  const [lathundsRes, runsRes] = await Promise.all([
    admin
      .from("lathunds")
      .select("*, lathund_steps(*)")
      .eq("status", "active")
      .order("sort_order"),
    admin
      .from("lathund_runs")
      .select("*, lathund_run_steps(*)")
      .eq("tenant_id", tenant.id)
      .eq("status", "in_progress"),
  ]);

  type StepRow = {
    id: string;
    step_number: number;
    title_sv: string;
    description_sv: string | null;
    link_path: string | null;
  };

  return (
    <main className="p-8">
      <PageHeader
        title="Lathundar"
        description="Klickbara steg-för-steg-guider för omfattning, incidenter, rapportering och tillsyn. Varje steg bockas av och loggas."
      />

      <LathundList
        tenantId={tenant.id}
        lathunds={(lathundsRes.data ?? []).map((l) => ({
          id: l.id,
          code: l.code,
          title: l.title_sv,
          purpose: l.purpose_sv,
          sourceReferences: l.source_references,
          steps: ((l.lathund_steps as StepRow[]) ?? [])
            .sort((a, b) => a.step_number - b.step_number)
            .map((s) => ({
              id: s.id,
              number: s.step_number,
              title: s.title_sv,
              description: s.description_sv,
              linkPath: s.link_path,
            })),
        }))}
        activeRuns={(runsRes.data ?? []).map((r) => ({
          id: r.id,
          lathundId: r.lathund_id,
          completedStepIds: (
            (r.lathund_run_steps as { step_id: string; completed: boolean }[]) ?? []
          )
            .filter((s) => s.completed)
            .map((s) => s.step_id),
        }))}
      />
    </main>
  );
}
