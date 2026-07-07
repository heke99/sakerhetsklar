import { redirect } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { DecisionSupportDisclaimer } from "@/components/app/disclaimer";
import { StatusBadge } from "@/components/app/status-badge";
import { Progress } from "@/components/ui/progress";
import { getCurrentTenant } from "@/lib/services/current-tenant";
import { getAdminClient } from "@/lib/server/supabase-admin";
import {
  computeDataQualityWarnings,
  computeReadiness,
  ensureControlsInstantiated,
} from "@/lib/services/readiness";

import { ControlRow } from "./control-row";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kontroller" };

export default async function ControlsPage() {
  const current = await getCurrentTenant();
  if (!current) redirect("/login");
  const { tenant } = current;

  await ensureControlsInstantiated(tenant.id);

  const admin = getAdminClient();
  const [controlsRes, readiness, warnings] = await Promise.all([
    admin
      .from("controls")
      .select("*")
      .eq("tenant_id", tenant.id)
      .is("deleted_at", null)
      .order("code"),
    computeReadiness(tenant.id),
    computeDataQualityWarnings(tenant.id),
  ]);

  const scores = [
    { label: "NIS2-readiness", value: readiness.nis2Readiness },
    { label: "Rapporteringsberedskap", value: readiness.reportingReadiness },
    { label: "Tillsynsberedskap", value: readiness.supervisoryReadiness },
    { label: "Ledningsberedskap", value: readiness.managementReadiness },
    { label: "Leverantörsberedskap", value: readiness.supplierReadiness },
    { label: "Incidentberedskap", value: readiness.incidentReadiness },
  ];

  return (
    <main className="p-8">
      <PageHeader
        title="Kontroller och readiness"
        description="NIS2-kontrollbibliotek med status, ägare, bevis och deadlines. Kontroller enligt MCFFS 2026:11 träder i kraft 1 oktober 2026."
      />
      <div className="mb-6">
        <DecisionSupportDisclaimer />
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {scores.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="text-xl font-bold">{s.value}%</p>
            </div>
            <Progress value={s.value} aria-label={s.label} />
          </div>
        ))}
      </div>

      {warnings.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Datakvalitetsvarningar</h2>
          <ul className="space-y-2">
            {warnings.map((w) => (
              <li key={w.ruleCode}>
                <a
                  href={w.linkPath ?? "#"}
                  className={`block rounded-lg border px-4 py-2.5 text-sm hover:opacity-90 ${
                    w.severity === "critical"
                      ? "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
                      : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
                  }`}
                >
                  {w.count > 1 ? `${w.count} × ` : ""}
                  {w.titleSv} — klicka för att åtgärda
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Kontroller ({readiness.controlsApproved}/{readiness.controlsTotal} klara
          {readiness.controlsOverdue > 0 ? `, ${readiness.controlsOverdue} försenade` : ""})
        </h2>
        <div className="space-y-2">
          {(controlsRes.data ?? []).map((c) => (
            <ControlRow key={c.id} tenantId={tenant.id} control={c} />
          ))}
        </div>
        {(controlsRes.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Kontrollbiblioteket instansieras vid första besöket. Ladda om sidan om
            listan är tom.
          </p>
        ) : null}
      </section>

      <section className="mt-8">
        <StatusBadge color="yellow">
          Kontroller med status pending_guidance uppdateras när slutliga föreskrifter träder i kraft.
        </StatusBadge>
      </section>
    </main>
  );
}
