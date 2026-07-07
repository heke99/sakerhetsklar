import Link from "next/link";
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
} from "@/lib/services/readiness";

export const dynamic = "force-dynamic";
export const metadata = { title: "Översikt" };

export default async function CustomerOverviewPage() {
  const current = await getCurrentTenant();
  if (!current) redirect("/login");
  const { tenant } = current;

  const admin = getAdminClient();
  const [scopeRes, readiness, warnings, incidentsRes, deadlinesRes, progressRes, approvalsRes] =
    await Promise.all([
      admin
        .from("scope_results")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      computeReadiness(tenant.id),
      computeDataQualityWarnings(tenant.id),
      admin
        .from("incidents")
        .select("id, status, significance_status")
        .eq("tenant_id", tenant.id)
        .is("deleted_at", null),
      admin
        .from("incident_deadlines")
        .select("id, due_at, status")
        .eq("tenant_id", tenant.id)
        .in("status", ["pending", "missed"]),
      admin
        .from("onboarding_progress")
        .select("step_key, status")
        .eq("tenant_id", tenant.id),
      admin
        .from("incident_significance_assessments")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("approval_status", "pending"),
    ]);

  const scope = scopeRes.data;
  const incidents = incidentsRes.data ?? [];
  const deadlines = deadlinesRes.data ?? [];
  const openIncidents = incidents.filter((i) => i.status !== "closed").length;
  const potentialSignificant = incidents.filter((i) =>
    ["potentially_significant", "manual_review_required"].includes(i.significance_status),
  ).length;
  const reportable = incidents.filter(
    (i) => i.significance_status === "significant_reportable",
  ).length;
  const missed = deadlines.filter((d) => d.status === "missed").length;
  const nowMsSnapshot = new Date().getTime();
  const dueSoon = deadlines.filter(
    (d) =>
      d.status === "pending" &&
      new Date(d.due_at).getTime() - nowMsSnapshot < 24 * 3600_000,
  ).length;

  const totalSteps = 10;
  const completedSteps = (progressRes.data ?? []).filter(
    (p) => p.status === "completed",
  ).length;
  const onboardingPct = Math.round((completedSteps / totalSteps) * 100);

  return (
    <main className="p-8">
      <PageHeader
        title="Översikt"
        description={`${tenant.name} — status, saknade uppgifter, ansvar och nästa steg.`}
      />
      <div className="mb-6">
        <DecisionSupportDisclaimer />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* 1. NIS2-status */}
        <Link href="/app/scope" className="rounded-xl border bg-card p-5 hover:bg-muted/40">
          <p className="text-sm text-muted-foreground">NIS2-status</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {scope ? (
              <>
                <StatusBadge
                  color={
                    scope.likely_covered === "yes"
                      ? "green"
                      : scope.likely_covered === "manual_review"
                        ? "purple"
                        : "gray"
                  }
                >
                  {scope.likely_covered === "yes"
                    ? "Omfattas sannolikt"
                    : scope.likely_covered === "manual_review"
                      ? "Manuell bedömning"
                      : "Omfattas ej"}
                </StatusBadge>
                {scope.classification ? (
                  <StatusBadge color="blue">
                    {scope.classification === "essential"
                      ? "Väsentlig"
                      : scope.classification === "important"
                        ? "Viktig"
                        : scope.classification === "public"
                          ? "Offentlig"
                          : "Manuell"}
                  </StatusBadge>
                ) : null}
              </>
            ) : (
              <StatusBadge color="gray">Ej bedömd</StatusBadge>
            )}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {scope
              ? `${(scope.active_rule_packages as string[]).length} aktiva regelpaket, ${(scope.pending_rule_packages as string[]).length} kommande/delvis`
              : "Starta onboarding för att skapa regelprofil."}
          </p>
        </Link>

        {/* 2. Onboarding */}
        <Link href="/app/onboarding" className="rounded-xl border bg-card p-5 hover:bg-muted/40">
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-muted-foreground">Onboarding</p>
            <p className="text-xl font-bold">{onboardingPct}%</p>
          </div>
          <div className="mt-2">
            <Progress value={onboardingPct} aria-label="Onboarding" />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {onboardingPct >= 100
              ? "Onboarding klar."
              : `${totalSteps - completedSteps} steg kvar — fortsätt guiden.`}
          </p>
        </Link>

        {/* 3. NIS2 readiness */}
        <Link href="/app/controls" className="rounded-xl border bg-card p-5 hover:bg-muted/40">
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-muted-foreground">NIS2-readiness</p>
            <p className="text-xl font-bold">{readiness.nis2Readiness}%</p>
          </div>
          <div className="mt-2">
            <Progress value={readiness.nis2Readiness} aria-label="NIS2-readiness" />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {readiness.controlsApproved}/{readiness.controlsTotal} kontroller klara
            {readiness.controlsMissingEvidence > 0
              ? ` · ${readiness.controlsMissingEvidence} saknar bevis`
              : ""}
            {readiness.controlsOverdue > 0 ? ` · ${readiness.controlsOverdue} försenade` : ""}
          </p>
        </Link>

        {/* 4. Reporting readiness */}
        <Link href="/app/settings" className="rounded-xl border bg-card p-5 hover:bg-muted/40">
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-muted-foreground">Rapporteringsberedskap</p>
            <p className="text-xl font-bold">{readiness.reportingReadiness}%</p>
          </div>
          <div className="mt-2">
            <Progress value={readiness.reportingReadiness} aria-label="Rapporteringsberedskap" />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Incidentroller, Cyberportalen-läge, mallar och godkännare.
          </p>
        </Link>

        {/* 5. Incidents */}
        <Link href="/app/incidents" className="rounded-xl border bg-card p-5 hover:bg-muted/40">
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-muted-foreground">Incidenter</p>
            <p className="text-xl font-bold">{openIncidents}</p>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {potentialSignificant > 0 ? (
              <StatusBadge color="yellow">{potentialSignificant} potentiellt betydande</StatusBadge>
            ) : null}
            {reportable > 0 ? (
              <StatusBadge color="red">{reportable} rapporteringspliktiga</StatusBadge>
            ) : null}
            {dueSoon > 0 ? (
              <StatusBadge color="yellow">{dueSoon} deadline inom 24h</StatusBadge>
            ) : null}
            {missed > 0 ? <StatusBadge color="red">{missed} missade deadlines</StatusBadge> : null}
            {openIncidents === 0 ? <StatusBadge color="green">Inga öppna</StatusBadge> : null}
          </div>
        </Link>

        {/* 6. Management */}
        <Link href="/app/management" className="rounded-xl border bg-card p-5 hover:bg-muted/40">
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-muted-foreground">Ledning</p>
            <p className="text-xl font-bold">{readiness.managementReadiness}%</p>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Ledningens utbildning: {readiness.managementReadiness}% ·{" "}
            {(approvalsRes.data ?? []).length} beslut väntar på godkännande.
          </p>
        </Link>
      </div>

      {/* 7. Data quality */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Datakvalitet — vad saknas?</h2>
        {warnings.length === 0 ? (
          <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
            Inga datakvalitetsvarningar. Bra jobbat!
          </p>
        ) : (
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
        )}
      </section>
    </main>
  );
}
