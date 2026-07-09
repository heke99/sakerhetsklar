import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { DecisionSupportDisclaimer } from "@/components/app/disclaimer";
import { StatusBadge } from "@/components/app/status-badge";
import { getCurrentTenant } from "@/lib/services/current-tenant";
import { getAdminClient } from "@/lib/server/supabase-admin";

import { RecipientDecisionForm } from "./recipient-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Informera mottagare" };

const decisionLabels: Record<string, string> = {
  inform_now: "Informera nu",
  wait_would_worsen_handling: "Vänta — information nu kan försvåra hanteringen",
  do_not_inform: "Informera inte",
  manual_review: "Manuell granskning",
};

export default async function RecipientNotificationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const current = await getCurrentTenant();
  if (!current) redirect("/login");
  const { tenant } = current;
  const { id } = await params;

  const admin = getAdminClient();
  const [incidentRes, decisionsRes] = await Promise.all([
    admin
      .from("incidents")
      .select("id, reference, title")
      .eq("id", id)
      .eq("tenant_id", tenant.id)
      .maybeSingle(),
    admin
      .from("recipient_notifications")
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
        title={`Informationsskyldighet till mottagare — ${incident.reference}`}
        description="Vid betydande incidenter som påverkar externa tjänster ska mottagare/kunder informeras om påverkan och åtgärder — om inte information just nu försvårar incidenthanteringen. Alla beslut kräver motivering och godkännare."
      />
      <div className="mb-6">
        <DecisionSupportDisclaimer />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <RecipientDecisionForm tenantId={tenant.id} incidentId={incident.id} />

        <section className="rounded-xl border bg-card p-6">
          <h2 className="mb-3 text-lg font-semibold">Beslutslogg</h2>
          {(decisionsRes.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga beslut fattade ännu.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {(decisionsRes.data ?? []).map((d) => (
                <li key={d.id} className="rounded-lg border p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <StatusBadge
                      color={
                        d.decision === "inform_now"
                          ? "green"
                          : d.decision === "manual_review"
                            ? "purple"
                            : "yellow"
                      }
                    >
                      {decisionLabels[d.decision] ?? d.decision}
                    </StatusBadge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(d.created_at).toLocaleString("sv-SE")}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{d.decision_reason}</p>
                  {d.message_draft ? (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-primary">
                        Visa meddelandeutkast
                      </summary>
                      <pre className="mt-1 rounded bg-muted/40 p-2 text-xs whitespace-pre-wrap">
                        {d.message_draft}
                      </pre>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="mt-6 text-sm">
        <Link href={`/app/incidents/${incident.id}`} className="text-primary hover:underline">
          ← Tillbaka till incidenten
        </Link>
      </p>
    </main>
  );
}
