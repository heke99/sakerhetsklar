import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { DecisionSupportDisclaimer } from "@/components/app/disclaimer";
import { StatusBadge } from "@/components/app/status-badge";
import { getCurrentTenant } from "@/lib/services/current-tenant";
import { getAdminClient } from "@/lib/server/supabase-admin";

import { WarRoomPanel } from "./war-room-panel";

export const dynamic = "force-dynamic";
export const metadata = { title: "War room" };

export default async function WarRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const current = await getCurrentTenant();
  if (!current) redirect("/login");
  const { tenant } = current;
  const { id } = await params;

  const admin = getAdminClient();
  const [incidentRes, warRoomRes, deadlinesRes, reportsRes, evidenceRes] = await Promise.all([
    admin
      .from("incidents")
      .select("id, reference, title, severity, significance_status")
      .eq("id", id)
      .eq("tenant_id", tenant.id)
      .maybeSingle(),
    admin
      .from("incident_war_rooms")
      .select("*, war_room_members(*), war_room_decisions(*), war_room_tasks(*), war_room_messages(*)")
      .eq("incident_id", id)
      .eq("tenant_id", tenant.id)
      .maybeSingle(),
    admin
      .from("incident_deadlines")
      .select("deadline_type, due_at, status")
      .eq("incident_id", id)
      .order("due_at"),
    admin
      .from("incident_reports")
      .select("id, report_stage, status")
      .eq("incident_id", id),
    admin
      .from("evidence")
      .select("id, file_name, classification")
      .eq("incident_id", id)
      .is("deleted_at", null)
      .limit(20),
  ]);

  const incident = incidentRes.data;
  if (!incident) notFound();

  return (
    <main className="p-8">
      <PageHeader
        title={`War room — ${incident.reference}`}
        description={`${incident.title}. Samlad ledning av allvarlig incident: beslut, uppgifter, deadlines, rapporter och bevis.`}
        actions={
          <div className="flex gap-2">
            <StatusBadge color={incident.severity === "critical" || incident.severity === "high" ? "red" : "yellow"}>
              {incident.severity}
            </StatusBadge>
            <StatusBadge color="purple">{incident.significance_status}</StatusBadge>
          </div>
        }
      />
      <div className="mb-6">
        <DecisionSupportDisclaimer />
      </div>

      <WarRoomPanel
        tenantId={tenant.id}
        incidentId={incident.id}
        warRoom={warRoomRes.data}
        deadlines={(deadlinesRes.data ?? []) as { deadline_type: string; due_at: string; status: string }[]}
        reports={(reportsRes.data ?? []) as { id: string; report_stage: string; status: string }[]}
        evidence={(evidenceRes.data ?? []) as { id: string; file_name: string; classification: string }[]}
      />

      <p className="mt-6 text-sm">
        <Link href={`/app/incidents/${incident.id}`} className="text-primary hover:underline">
          ← Tillbaka till incidenten
        </Link>
      </p>
    </main>
  );
}
