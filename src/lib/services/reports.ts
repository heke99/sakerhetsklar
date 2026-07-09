import "server-only";

import {
  getTenantControlPlaneClient,
  getTenantDataPlaneClient,
} from "@/lib/server/data-plane";
import { writeAuditLog } from "@/lib/audit/log";
import type { ActorContext } from "@/lib/authz/context";
import { assertTenantEntity } from "@/lib/authz/tenant-guards";

export type ReportStage =
  | "early_warning_24h"
  | "incident_notification_72h"
  | "final_report"
  | "situation_report"
  | "state_agency_6h"
  | "imy_report"
  | "eidas_report";

const STAGE_TITLES: Record<ReportStage, string> = {
  early_warning_24h: "Upplysning (24 timmar)",
  incident_notification_72h: "Incidentanmälan (72 timmar)",
  final_report: "Slutrapport",
  situation_report: "Lägesrapport",
  state_agency_6h: "Statlig varning (6 timmar)",
  imy_report: "Anmälan till IMY",
  eidas_report: "eIDAS-rapport",
};

export function stageTitle(stage: ReportStage): string {
  return STAGE_TITLES[stage] ?? stage;
}

/** Creates a report draft with fields prefilled from incident/tenant data. */
export async function createReportDraft(
  actor: ActorContext,
  input: { tenantId: string; incidentId: string; stage: ReportStage; trackCode?: string },
) {
  // Tenant business data lives in the tenant's data plane (A: central,
  // B/C: isolated); tenant registry + report field definitions are
  // control-plane reference data.
  const admin = await getTenantDataPlaneClient(input.tenantId);
  const control = getTenantControlPlaneClient();

  const [incidentRes, tenantRes, fieldDefsRes, deadlineRes] = await Promise.all([
    admin
      .from("incidents")
      .select("*")
      .eq("id", input.incidentId)
      .eq("tenant_id", input.tenantId)
      .maybeSingle(),
    control
      .from("tenants")
      .select("name, organization_number, primary_contact_name, primary_contact_email, primary_contact_phone")
      .eq("id", input.tenantId)
      .maybeSingle(),
    control
      .from("report_field_definitions")
      .select("*")
      .eq("report_stage", input.stage)
      .eq("status", "active")
      .order("sort_order"),
    admin
      .from("incident_deadlines")
      .select("due_at")
      .eq("incident_id", input.incidentId)
      .eq("deadline_type", stageDeadlineType(input.stage))
      .maybeSingle(),
  ]);

  const incident = incidentRes.data;
  if (!incident) throw new Error("Incident not found");
  const tenant = tenantRes.data;

  const { data: report, error } = await admin
    .from("incident_reports")
    .upsert(
      {
        tenant_id: input.tenantId,
        incident_id: input.incidentId,
        report_stage: input.stage,
        track_code: input.trackCode ?? defaultTrack(input.stage),
        due_at: deadlineRes.data?.due_at ?? null,
        created_by: actor.userId,
      },
      { onConflict: "incident_id,report_stage,track_code", ignoreDuplicates: false },
    )
    .select()
    .single();
  if (error) throw new Error(error.message);

  // Prefill values from known data.
  const prefill: Record<string, string> = {
    organization_name: tenant?.name ?? "",
    organization_number: tenant?.organization_number ?? "",
    agency_name: tenant?.name ?? "",
    contact_details: [
      tenant?.primary_contact_name,
      tenant?.primary_contact_email,
      tenant?.primary_contact_phone,
    ]
      .filter(Boolean)
      .join(", "),
    contact_details_sa: [
      tenant?.primary_contact_name,
      tenant?.primary_contact_email,
    ]
      .filter(Boolean)
      .join(", "),
    incident_ongoing: incident.is_ongoing ? "Ja" : "Nej",
    detected_at: incident.incident_detected_at ?? "",
    occurred_at: incident.incident_started_at ?? "",
    ended_at: incident.incident_ended_at ?? "",
    detection_method: incident.detection_method ?? "",
    suspected_malicious:
      incident.suspected_malicious === true
        ? "Ja"
        : incident.suspected_malicious === false
          ? "Nej"
          : "",
    supplier_origin:
      incident.supplier_origin === true
        ? "Ja"
        : incident.supplier_origin === false
          ? "Nej"
          : "",
    event_timeline: incident.description ?? "",
  };

  const fieldRows = (fieldDefsRes.data ?? []).map((def) => ({
    tenant_id: input.tenantId,
    report_id: report.id,
    field_key: def.field_key,
    value: prefill[def.field_key] ?? null,
    updated_by: actor.userId,
  }));
  if (fieldRows.length > 0) {
    await admin
      .from("incident_report_fields")
      .upsert(fieldRows, { onConflict: "report_id,field_key", ignoreDuplicates: true });
  }

  await admin.from("incident_events").insert({
    tenant_id: input.tenantId,
    incident_id: input.incidentId,
    event_type: "report_generated",
    title: `Rapportutkast skapat: ${stageTitle(input.stage)}`,
    created_by: actor.userId,
  });

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: "report.generated",
    entityType: "incident_report",
    entityId: report.id,
    newValue: { stage: input.stage, incidentId: input.incidentId },
  });

  return report;
}

function defaultTrack(stage: ReportStage): string {
  if (stage === "state_agency_6h") return "STATE_AGENCY";
  if (stage === "imy_report") return "GDPR_IMY";
  if (stage === "eidas_report") return "EIDAS_PTS";
  return "NIS2_CYBERPORTALEN";
}

function stageDeadlineType(stage: ReportStage): string {
  switch (stage) {
    case "early_warning_24h":
      return "early_warning";
    case "incident_notification_72h":
      return "incident_notification";
    case "final_report":
      return "final_report";
    case "situation_report":
      return "situation_report";
    case "state_agency_6h":
      return "state_agency_warning";
    case "imy_report":
      return "imy_notification";
    default:
      return stage;
  }
}

export async function updateReportFields(
  actor: ActorContext,
  input: { tenantId: string; reportId: string; fields: Record<string, string> },
) {
  const admin = await getTenantDataPlaneClient(input.tenantId);

  // The report must belong to the tenant before any field rows are written.
  await assertTenantEntity("incident_reports", input.reportId, input.tenantId);

  for (const [key, value] of Object.entries(input.fields)) {
    await admin
      .from("incident_report_fields")
      .upsert(
        {
          tenant_id: input.tenantId,
          report_id: input.reportId,
          field_key: key,
          value,
          updated_by: actor.userId,
        },
        { onConflict: "report_id,field_key" },
      );
  }
  await admin
    .from("incident_reports")
    .update({ updated_by: actor.userId })
    .eq("id", input.reportId);
}

/**
 * Report status transitions with Cyberportalen ID gating (spec §18): a report
 * stage cannot be closed without a stage-specific ID or an explicit override
 * reason.
 */
export async function setReportStatus(
  actor: ActorContext,
  input: {
    tenantId: string;
    reportId: string;
    status:
      | "ready_for_review"
      | "approved"
      | "submitted_in_cyberportalen"
      | "cyberportal_incident_id_saved"
      | "receipt_uploaded";
    cyberportalId?: string;
    overrideReason?: string;
    submissionMethod?: "cyberportalen" | "reserve_procedure" | "other";
  },
) {
  const admin = await getTenantDataPlaneClient(input.tenantId);
  const { data: report } = await admin
    .from("incident_reports")
    .select("*")
    .eq("id", input.reportId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (!report) throw new Error("Report not found");

  const update: Record<string, unknown> = {
    status: input.status,
    updated_by: actor.userId,
  };

  if (input.status === "approved") {
    update.approved_by = actor.userId;
    update.approved_at = new Date().toISOString();
  }

  if (input.status === "submitted_in_cyberportalen") {
    update.submitted_marked_by = actor.userId;
    update.submitted_marked_at = new Date().toISOString();
    update.submission_method = input.submissionMethod ?? "cyberportalen";

    await admin.from("incident_report_submissions").insert({
      tenant_id: input.tenantId,
      report_id: input.reportId,
      submitted_by: actor.userId,
      method: input.submissionMethod ?? "cyberportalen",
    });

    // Mark the corresponding legal deadline as met.
    await admin
      .from("incident_deadlines")
      .update({ status: "met", met_at: new Date().toISOString() })
      .eq("incident_id", report.incident_id)
      .eq("deadline_type", stageDeadlineType(report.report_stage as ReportStage))
      .eq("status", "pending");
  }

  if (input.status === "cyberportal_incident_id_saved") {
    if (input.cyberportalId) {
      await admin.from("cyberportal_incident_ids").upsert(
        {
          tenant_id: input.tenantId,
          incident_id: report.incident_id,
          report_id: input.reportId,
          report_stage: report.report_stage,
          cyberportal_id: input.cyberportalId,
          saved_by: actor.userId,
        },
        { onConflict: "incident_id,report_stage" },
      );
      await writeAuditLog({
        tenantId: input.tenantId,
        actorUserId: actor.userId,
        action: "report.cyberportal_id_saved",
        entityType: "incident_report",
        entityId: input.reportId,
        newValue: { stage: report.report_stage, cyberportalId: input.cyberportalId },
      });
    } else if (input.overrideReason) {
      update.close_override_reason = input.overrideReason;
      await writeAuditLog({
        tenantId: input.tenantId,
        actorUserId: actor.userId,
        action: "report.closed_without_cyberportal_id",
        entityType: "incident_report",
        entityId: input.reportId,
        reason: input.overrideReason,
      });
    } else {
      throw new Error(
        "Cyberportalen-ID krävs. Ange ID eller en uttrycklig motivering för att stänga utan ID.",
      );
    }
  }

  const { data, error } = await admin
    .from("incident_reports")
    .update(update)
    .eq("id", input.reportId)
    .select()
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action:
      input.status === "approved"
        ? "report.approved"
        : input.status === "submitted_in_cyberportalen"
          ? "report.marked_submitted"
          : "report.status_changed",
    entityType: "incident_report",
    entityId: input.reportId,
    previousValue: { status: report.status },
    newValue: { status: input.status },
  });

  return data;
}
