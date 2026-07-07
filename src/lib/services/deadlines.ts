import "server-only";

import { getAdminClient } from "@/lib/server/supabase-admin";
import { writeAuditLog } from "@/lib/audit/log";
import {
  computeDeadlines,
  internalSlaDefinitions,
  pendingEscalations,
  type DeadlineDefinitionInput,
} from "@/lib/deadlines/engine";

/**
 * Creates/updates concrete deadlines for an incident based on the latest
 * significance assessment and tenant SLA settings.
 */
export async function createDeadlinesForIncident(input: {
  tenantId: string;
  incidentId: string;
  actorUserId?: string;
}): Promise<void> {
  const admin = getAdminClient();

  const [incidentRes, assessmentRes, settingsRes, notificationRes] = await Promise.all([
    admin
      .from("incidents")
      .select("id, identified_as_significant_at")
      .eq("id", input.incidentId)
      .eq("tenant_id", input.tenantId)
      .maybeSingle(),
    admin
      .from("incident_significance_assessments")
      .select("deadline_definitions")
      .eq("incident_id", input.incidentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("tenant_settings").select("*").eq("tenant_id", input.tenantId).maybeSingle(),
    admin
      .from("incident_reports")
      .select("submitted_marked_at")
      .eq("incident_id", input.incidentId)
      .eq("report_stage", "incident_notification_72h")
      .maybeSingle(),
  ]);

  const incident = incidentRes.data;
  if (!incident?.identified_as_significant_at) return;

  const legalDefs = (assessmentRes.data?.deadline_definitions ?? []) as DeadlineDefinitionInput[];
  const slaDefs = settingsRes.data ? internalSlaDefinitions(settingsRes.data) : [];

  const anchors = {
    identifiedAsSignificantAt: new Date(incident.identified_as_significant_at),
    notificationSubmittedAt: notificationRes.data?.submitted_marked_at
      ? new Date(notificationRes.data.submitted_marked_at)
      : null,
  };

  const legal = computeDeadlines(legalDefs, anchors);
  const sla = computeDeadlines(slaDefs, anchors);

  for (const d of legal) {
    await admin.from("incident_deadlines").upsert(
      {
        tenant_id: input.tenantId,
        incident_id: input.incidentId,
        deadline_type: d.deadlineType,
        due_at: d.dueAt.toISOString(),
        legal_reference: d.legalReference,
        is_internal_sla: false,
      },
      { onConflict: "incident_id,deadline_type,track_code", ignoreDuplicates: true },
    );
  }
  for (const d of sla) {
    await admin.from("incident_deadlines").upsert(
      {
        tenant_id: input.tenantId,
        incident_id: input.incidentId,
        deadline_type: d.deadlineType,
        due_at: d.dueAt.toISOString(),
        is_internal_sla: true,
      },
      { onConflict: "incident_id,deadline_type,track_code", ignoreDuplicates: true },
    );
  }
}

/**
 * Escalation job (spec §19): fires reminder/escalation notifications, marks
 * missed deadlines and opens late-reporting records. Idempotent — escalation
 * state is tracked per deadline.
 */
export async function processDeadlineEscalations(now = new Date()): Promise<{
  notificationsCreated: number;
  deadlinesMissed: number;
  lateRecordsCreated: number;
}> {
  const admin = getAdminClient();

  const { data: deadlines } = await admin
    .from("incident_deadlines")
    .select("*, incidents(reference, title)")
    .eq("status", "pending");

  let notificationsCreated = 0;
  let deadlinesMissed = 0;
  let lateRecordsCreated = 0;

  for (const deadline of deadlines ?? []) {
    const dueAt = new Date(deadline.due_at);
    const fired = new Set<string>(
      Object.keys((deadline.escalation_state as Record<string, unknown>) ?? {}),
    );
    const events = pendingEscalations(dueAt, now, fired);
    if (events.length === 0) continue;

    const incident = deadline.incidents as unknown as { reference: string; title: string } | null;
    const newState = { ...((deadline.escalation_state as Record<string, string>) ?? {}) };

    // Resolve notification recipients by role.
    const { data: assignments } = await admin
      .from("role_assignments")
      .select("user_id, roles(code)")
      .eq("tenant_id", deadline.tenant_id)
      .eq("status", "active");
    type AssignmentRow = { user_id: string; roles: { code: string } | null };
    const usersByRole = new Map<string, string[]>();
    for (const a of (assignments ?? []) as unknown as AssignmentRow[]) {
      if (!a.roles) continue;
      const list = usersByRole.get(a.roles.code) ?? [];
      list.push(a.user_id);
      usersByRole.set(a.roles.code, list);
    }

    for (const event of events) {
      newState[event.key] = now.toISOString();

      const recipients = new Set<string>();
      for (const role of event.targets) {
        for (const userId of usersByRole.get(role) ?? []) recipients.add(userId);
      }
      const rows = [...recipients].map((userId) => ({
        tenant_id: deadline.tenant_id,
        user_id: userId,
        type: "deadline_escalation",
        severity: event.severity,
        title: `${incident?.reference ?? "Incident"}: ${deadline.deadline_type}`,
        body: event.messageSv,
        link_path: `/app/incidents/${deadline.incident_id}/reports`,
        entity_type: "incident_deadline",
        entity_id: deadline.id,
      }));
      if (rows.length > 0) {
        await admin.from("notifications").insert(rows);
        notificationsCreated += rows.length;
      }

      if (event.key === "t_zero" && !deadline.is_internal_sla) {
        await admin
          .from("incident_deadlines")
          .update({ status: "missed", escalation_state: newState })
          .eq("id", deadline.id);
        deadlinesMissed += 1;

        await writeAuditLog({
          tenantId: deadline.tenant_id,
          action: "deadline.missed",
          entityType: "incident_deadline",
          entityId: deadline.id,
          newValue: { deadlineType: deadline.deadline_type, dueAt: deadline.due_at },
        });
      }

      if (event.key === "t_plus_1h" && !deadline.is_internal_sla) {
        const { data: existing } = await admin
          .from("late_reporting_records")
          .select("id")
          .eq("incident_id", deadline.incident_id)
          .eq("deadline_type", deadline.deadline_type)
          .maybeSingle();
        if (!existing) {
          const { data: incidentRow } = await admin
            .from("incidents")
            .select("incident_detected_at, incident_known_at, identified_as_significant_at")
            .eq("id", deadline.incident_id)
            .maybeSingle();

          await admin.from("late_reporting_records").insert({
            tenant_id: deadline.tenant_id,
            incident_id: deadline.incident_id,
            deadline_id: deadline.id,
            deadline_type: deadline.deadline_type,
            due_at: deadline.due_at,
            first_detected_at: incidentRow?.incident_detected_at ?? null,
            known_internally_at: incidentRow?.incident_known_at ?? null,
            identified_significant_at: incidentRow?.identified_as_significant_at ?? null,
          });
          lateRecordsCreated += 1;

          await admin.from("incident_tasks").insert({
            tenant_id: deadline.tenant_id,
            incident_id: deadline.incident_id,
            title: `Skriv förklaring för sen rapportering (${deadline.deadline_type})`,
            task_type: "late_explanation",
            status: "open",
          });

          await writeAuditLog({
            tenantId: deadline.tenant_id,
            action: "late_report.explanation_created",
            entityType: "late_reporting_record",
            entityId: deadline.id,
            newValue: { deadlineType: deadline.deadline_type },
          });
        }
      }
    }

    // Persist escalation state for non-missed deadlines.
    if (!events.some((e) => e.key === "t_zero" && !deadline.is_internal_sla)) {
      await admin
        .from("incident_deadlines")
        .update({ escalation_state: newState })
        .eq("id", deadline.id);
    }
  }

  return { notificationsCreated, deadlinesMissed, lateRecordsCreated };
}
