import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Progress } from "@/components/ui/progress";
import { getCurrentTenant } from "@/lib/services/current-tenant";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { computeReadiness } from "@/lib/services/readiness";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ledningsvy" };

export default async function ManagementPage() {
  const current = await getCurrentTenant();
  if (!current) redirect("/login");
  const { tenant } = current;

  const admin = getAdminClient();
  const [readiness, risksRes, incidentsRes, deadlinesRes, exercisesRes, approvalsRes, actionsRes, trainingRes, membersRes] =
    await Promise.all([
      computeReadiness(tenant.id),
      admin
        .from("risks")
        .select("id, risk_level, status")
        .eq("tenant_id", tenant.id)
        .is("deleted_at", null),
      admin
        .from("incidents")
        .select("id, status, significance_status")
        .eq("tenant_id", tenant.id)
        .is("deleted_at", null),
      admin
        .from("incident_deadlines")
        .select("id, deadline_type, due_at, status")
        .eq("tenant_id", tenant.id)
        .in("status", ["pending", "missed"])
        .order("due_at"),
      admin
        .from("exercise_runs")
        .select("created_at, score")
        .eq("tenant_id", tenant.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1),
      admin
        .from("incident_significance_assessments")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("approval_status", "pending"),
      admin
        .from("action_plans")
        .select("id, status, due_date")
        .eq("tenant_id", tenant.id)
        .neq("status", "done"),
      admin.from("management_training_records").select("id").eq("tenant_id", tenant.id),
      admin.from("management_members").select("id").eq("tenant_id", tenant.id),
    ]);

  const risks = risksRes.data ?? [];
  const incidents = incidentsRes.data ?? [];
  const deadlines = deadlinesRes.data ?? [];
  const criticalOpenRisks = risks.filter(
    (r) => (r.risk_level === "critical" || r.risk_level === "high") && r.status !== "closed",
  ).length;
  const activeIncidents = incidents.filter((i) => i.status !== "closed").length;
  const significantIncidents = incidents.filter(
    (i) => i.significance_status === "significant_reportable",
  ).length;
  const missedDeadlines = deadlines.filter((d) => d.status === "missed").length;
  const overdueActions = (actionsRes.data ?? []).filter(
    (a) => a.due_date && new Date(a.due_date) < new Date(),
  ).length;

  const scoreCards = [
    { label: "NIS2-readiness", value: readiness.nis2Readiness },
    { label: "Rapporteringsberedskap", value: readiness.reportingReadiness },
    { label: "Tillsynsberedskap", value: readiness.supervisoryReadiness },
  ];

  return (
    <main className="p-8">
      <PageHeader
        title="Ledningsvy"
        description="Sammanfattning för ledning och styrelse: readiness, risker, incidenter, deadlines och beslut som väntar."
        actions={
          <div className="flex gap-2">
            <a
              href={`/api/v1/exports?tenantId=${tenant.id}&type=board-report&format=pdf`}
              className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Styrelserapport (PDF)
            </a>
            <a
              href={`/api/v1/exports?tenantId=${tenant.id}&type=board-report&format=docx`}
              className="inline-flex h-8 items-center rounded-lg border px-3 text-sm font-medium hover:bg-muted"
            >
              Word
            </a>
          </div>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {scoreCards.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="text-xl font-bold">{s.value}%</p>
            </div>
            <Progress value={s.value} aria-label={s.label} />
          </div>
        ))}
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/app/risks" className="rounded-xl border bg-card p-4 hover:bg-muted/40">
          <p className="text-sm text-muted-foreground">Aktiva risker</p>
          <p className="mt-1 text-2xl font-bold">{risks.filter((r) => r.status !== "closed").length}</p>
          <p className="text-xs text-muted-foreground">{criticalOpenRisks} kritiska/höga öppna</p>
        </Link>
        <Link href="/app/incidents" className="rounded-xl border bg-card p-4 hover:bg-muted/40">
          <p className="text-sm text-muted-foreground">Aktiva incidenter</p>
          <p className="mt-1 text-2xl font-bold">{activeIncidents}</p>
          <p className="text-xs text-muted-foreground">{significantIncidents} betydande</p>
        </Link>
        <Link href="/app/reports" className="rounded-xl border bg-card p-4 hover:bg-muted/40">
          <p className="text-sm text-muted-foreground">Missade deadlines</p>
          <p className={`mt-1 text-2xl font-bold ${missedDeadlines > 0 ? "text-red-600" : ""}`}>
            {missedDeadlines}
          </p>
          <p className="text-xs text-muted-foreground">{deadlines.length} öppna deadlines totalt</p>
        </Link>
        <Link href="/app/controls" className="rounded-xl border bg-card p-4 hover:bg-muted/40">
          <p className="text-sm text-muted-foreground">Försenade åtgärder</p>
          <p className="mt-1 text-2xl font-bold">{overdueActions}</p>
          <p className="text-xs text-muted-foreground">
            {readiness.controlsOverdue} försenade kontroller
          </p>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 text-lg font-semibold">Kommande deadlines</h2>
          <ul className="space-y-2 text-sm">
            {deadlines.length === 0 ? (
              <li className="text-muted-foreground">Inga öppna rapporteringsdeadlines.</li>
            ) : (
              deadlines.slice(0, 8).map((d) => (
                <li key={d.id} className="flex items-center gap-2">
                  <StatusBadge color={d.status === "missed" ? "red" : "yellow"}>
                    {d.deadline_type}
                  </StatusBadge>
                  {new Date(d.due_at).toLocaleString("sv-SE")}
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 text-lg font-semibold">Ledning och styrning</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Ledningens utbildning</dt>
              <dd>
                {(membersRes.data ?? []).length === 0
                  ? "Inga ledningsmedlemmar registrerade"
                  : `${(trainingRes.data ?? []).length} av ${(membersRes.data ?? []).length} utbildade (${readiness.managementReadiness} %)`}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Senaste tabletop-övning</dt>
              <dd>
                {exercisesRes.data?.[0]
                  ? `${new Date(exercisesRes.data[0].created_at).toLocaleDateString("sv-SE")} (poäng ${exercisesRes.data[0].score ?? "–"})`
                  : "Ingen genomförd"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Beslut som väntar på ledningen</dt>
              <dd>{(approvalsRes.data ?? []).length}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm">
            <Link href="/app/exercises" className="text-primary hover:underline">
              Planera övning →
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
