import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { DecisionSupportDisclaimer } from "@/components/app/disclaimer";
import { StatusBadge, type StatusColor } from "@/components/app/status-badge";
import { getCurrentTenant } from "@/lib/services/current-tenant";
import { getAdminClient } from "@/lib/server/supabase-admin";

import { IncidentActions } from "./incident-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Incident" };

const significanceColors: Record<string, StatusColor> = {
  not_assessed: "gray",
  assessment_in_progress: "blue",
  not_reportable: "green",
  monitor: "yellow",
  potentially_significant: "yellow",
  significant_reportable: "red",
  manual_review_required: "purple",
};

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const current = await getCurrentTenant();
  if (!current) redirect("/login");
  const { tenant } = current;
  const { id } = await params;

  const admin = getAdminClient();
  const { data: incident } = await admin
    .from("incidents")
    .select(
      `*,
       incident_events(*),
       incident_system_impacts(*, systems(name)),
       incident_service_impacts(*, critical_services(name)),
       incident_vendor_impacts(*, vendors(name)),
       incident_tasks(*),
       incident_comments(*),
       incident_decision_logs(*)`,
    )
    .eq("id", id)
    .eq("tenant_id", tenant.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!incident) notFound();

  type Rel<T> = T[];
  const events = (incident.incident_events as Rel<{
    id: string;
    title: string;
    detail: string | null;
    occurred_at: string;
    event_type: string;
  }>).sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1));
  const tasks = incident.incident_tasks as Rel<{
    id: string;
    title: string;
    status: string;
    assigned_to_name: string | null;
    due_at: string | null;
    task_type: string | null;
  }>;
  const comments = (incident.incident_comments as Rel<{
    id: string;
    body: string;
    created_by_name: string | null;
    created_at: string;
  }>).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const { data: deadlineRows } = await admin
    .from("incident_deadlines")
    .select("id, deadline_type, due_at, status")
    .eq("incident_id", incident.id)
    .order("due_at");
  const deadlines = (deadlineRows ?? []) as Rel<{
    id: string;
    deadline_type: string;
    due_at: string;
    status: string;
  }>;
  const nowMs = Date.now();

  return (
    <main className="p-8">
      <PageHeader
        title={`${incident.reference}: ${incident.title}`}
        description={incident.description ?? undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge color={incident.is_ongoing ? "red" : "green"}>
              {incident.is_ongoing ? "Pågående" : "Avslutad"}
            </StatusBadge>
            <StatusBadge
              color={
                incident.severity === "critical" || incident.severity === "high"
                  ? "red"
                  : incident.severity === "medium"
                    ? "yellow"
                    : "green"
              }
            >
              {incident.severity}
            </StatusBadge>
            <StatusBadge color={significanceColors[incident.significance_status] ?? "gray"}>
              {incident.significance_status}
            </StatusBadge>
          </div>
        }
      />
      <div className="mb-6">
        <DecisionSupportDisclaimer />
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href={`/app/incidents/${incident.id}/assessment`}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Är incidenten betydande? — kör bedömning
        </Link>
        <Link
          href={`/app/incidents/${incident.id}/reports`}
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Rapporter och Cyberportalen
        </Link>
        <Link
          href={`/app/incidents/${incident.id}/war-room`}
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          War room
        </Link>
        <Link
          href={`/app/incidents/${incident.id}/gdpr`}
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          GDPR-spår
        </Link>
      </div>

      {deadlines.length > 0 ? (
        <section className="mb-6 rounded-xl border bg-card p-5">
          <h2 className="mb-3 text-lg font-semibold">Deadlines</h2>
          <ul className="space-y-1 text-sm">
            {deadlines.map((d) => (
              <li key={d.id} className="flex items-center gap-2">
                <StatusBadge
                  color={
                    d.status === "missed"
                      ? "red"
                      : d.status === "met"
                        ? "green"
                        : new Date(d.due_at).getTime() - nowMs < 6 * 3600_000
                          ? "yellow"
                          : "blue"
                  }
                >
                  {d.deadline_type}
                </StatusBadge>
                <span>{new Date(d.due_at).toLocaleString("sv-SE")}</span>
                <span className="text-muted-foreground">({d.status})</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 text-lg font-semibold">Påverkan</h2>
          <h3 className="text-sm font-medium text-muted-foreground">System</h3>
          <ul className="mb-3 space-y-1 text-sm">
            {(incident.incident_system_impacts as Rel<{ id: string; impact_type: string; systems: { name: string } | null }>).map((im) => (
              <li key={im.id}>
                {im.systems?.name ?? "Okänt system"} — {im.impact_type}
              </li>
            ))}
            {(incident.incident_system_impacts as unknown[]).length === 0 ? (
              <li className="text-muted-foreground">Inga system kopplade.</li>
            ) : null}
          </ul>
          <h3 className="text-sm font-medium text-muted-foreground">Kritiska tjänster</h3>
          <ul className="mb-3 space-y-1 text-sm">
            {(incident.incident_service_impacts as Rel<{ id: string; impact_type: string; critical_services: { name: string } | null }>).map((im) => (
              <li key={im.id}>
                {im.critical_services?.name ?? "Okänd tjänst"} — {im.impact_type}
              </li>
            ))}
            {(incident.incident_service_impacts as unknown[]).length === 0 ? (
              <li className="text-muted-foreground">Inga tjänster kopplade.</li>
            ) : null}
          </ul>
          <h3 className="text-sm font-medium text-muted-foreground">Leverantörer</h3>
          <ul className="space-y-1 text-sm">
            {(incident.incident_vendor_impacts as Rel<{ id: string; role: string; vendors: { name: string } | null }>).map((im) => (
              <li key={im.id}>
                {im.vendors?.name ?? "Okänd leverantör"} — {im.role}
              </li>
            ))}
            {(incident.incident_vendor_impacts as unknown[]).length === 0 ? (
              <li className="text-muted-foreground">Inga leverantörer kopplade.</li>
            ) : null}
          </ul>
        </section>

        <IncidentActions
          tenantId={tenant.id}
          incidentId={incident.id}
          currentStatus={incident.status}
        />

        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 text-lg font-semibold">Uppgifter ({tasks.length})</h2>
          <ul className="space-y-2 text-sm">
            {tasks.length === 0 ? (
              <li className="text-muted-foreground">Inga uppgifter.</li>
            ) : (
              tasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                  <span>
                    {t.title}
                    {t.assigned_to_name ? (
                      <span className="text-muted-foreground"> · {t.assigned_to_name}</span>
                    ) : null}
                    {t.due_at ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · senast {new Date(t.due_at).toLocaleString("sv-SE")}
                      </span>
                    ) : null}
                  </span>
                  <StatusBadge
                    color={t.status === "done" ? "green" : t.status === "in_progress" ? "blue" : "gray"}
                  >
                    {t.status}
                  </StatusBadge>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 text-lg font-semibold">Tidslinje</h2>
          <ol className="space-y-3 text-sm">
            {events.map((e) => (
              <li key={e.id} className="border-l-2 border-border pl-3">
                <p className="font-medium">{e.title}</p>
                {e.detail ? <p className="text-muted-foreground">{e.detail}</p> : null}
                <p className="text-xs text-muted-foreground">
                  {new Date(e.occurred_at).toLocaleString("sv-SE")}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-xl border bg-card p-5 lg:col-span-2">
          <h2 className="mb-3 text-lg font-semibold">Kommentarer</h2>
          <ul className="space-y-3 text-sm">
            {comments.length === 0 ? (
              <li className="text-muted-foreground">Inga kommentarer.</li>
            ) : (
              comments.map((c) => (
                <li key={c.id} className="rounded-lg border px-3 py-2">
                  <p>{c.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.created_by_name ?? "Okänd"} · {new Date(c.created_at).toLocaleString("sv-SE")}
                  </p>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </main>
  );
}
