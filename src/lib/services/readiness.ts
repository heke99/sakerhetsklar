import "server-only";

import { getAdminClient } from "@/lib/server/supabase-admin";

export interface ReadinessScores {
  nis2Readiness: number;
  reportingReadiness: number;
  supervisoryReadiness: number;
  managementReadiness: number;
  supplierReadiness: number;
  incidentReadiness: number;
  controlsTotal: number;
  controlsApproved: number;
  controlsOverdue: number;
  controlsMissingEvidence: number;
}

export interface DataQualityWarning {
  ruleCode: string;
  titleSv: string;
  severity: "info" | "warning" | "critical";
  count: number;
  linkPath: string | null;
}

function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

/** Instantiates tenant controls from the requirement library if none exist. */
export async function ensureControlsInstantiated(tenantId: string): Promise<void> {
  const admin = getAdminClient();
  const { count } = await admin
    .from("controls")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if ((count ?? 0) > 0) return;

  const { data: requirements } = await admin
    .from("control_requirements")
    .select("*")
    .in("status", ["active", "pending_guidance"])
    .order("sort_order");

  if (!requirements || requirements.length === 0) return;

  await admin.from("controls").insert(
    requirements.map((r) => ({
      tenant_id: tenantId,
      requirement_id: r.id,
      code: r.code,
      area: r.area,
      title_sv: r.title_sv,
      description_sv: r.description_sv,
      legal_reference: r.legal_reference,
      owner_role: r.default_owner_role,
      evidence_required: r.evidence_required,
      status: "not_started",
    })),
  );
}

export async function computeReadiness(tenantId: string): Promise<ReadinessScores> {
  const admin = getAdminClient();

  const [controlsRes, rolesRes, vendorsRes, trainingRes, membersRes, fieldsRes] =
    await Promise.all([
      admin
        .from("controls")
        .select("status, evidence_required, evidence_uploaded, area, deadline")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null),
      admin
        .from("role_assignments")
        .select("roles(code)")
        .eq("tenant_id", tenantId)
        .eq("status", "active"),
      admin
        .from("vendors")
        .select("incident_contact_name, incident_contact_email, risk_rating")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null),
      admin.from("management_training_records").select("id").eq("tenant_id", tenantId),
      admin.from("management_members").select("id").eq("tenant_id", tenantId),
      admin
        .from("report_field_definitions")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
    ]);

  const controls = controlsRes.data ?? [];
  const done = controls.filter(
    (c) => c.status === "approved" || c.status === "not_applicable",
  ).length;
  const overdue = controls.filter(
    (c) =>
      c.status !== "approved" &&
      c.status !== "not_applicable" &&
      c.deadline &&
      new Date(c.deadline) < new Date(),
  ).length;
  const missingEvidence = controls.filter(
    (c) => c.status === "approved" && c.evidence_required && !c.evidence_uploaded,
  ).length;

  type RoleRow = { roles: { code: string } | null };
  const roleCodes = new Set(
    ((rolesRes.data ?? []) as unknown as RoleRow[])
      .map((r) => r.roles?.code)
      .filter(Boolean) as string[],
  );

  const incidentRoles = [
    "incident_manager",
    "ciso",
    "legal_compliance",
    "management_approver",
  ];
  const incidentRolesAssigned = incidentRoles.filter((r) => roleCodes.has(r)).length;
  const templatesReady = (fieldsRes.count ?? 0) > 0;

  const reportingChecks = [
    incidentRolesAssigned === incidentRoles.length,
    roleCodes.has("dpo"),
    roleCodes.has("communications_lead"),
    templatesReady,
  ];
  const reportingReadiness = pct(
    reportingChecks.filter(Boolean).length,
    reportingChecks.length,
  );

  const vendors = vendorsRes.data ?? [];
  const vendorsWithContact = vendors.filter(
    (v) => v.incident_contact_name || v.incident_contact_email,
  ).length;
  const vendorsAssessed = vendors.filter((v) => v.risk_rating).length;
  const supplierReadiness =
    vendors.length === 0
      ? 0
      : Math.round(
          (pct(vendorsWithContact, vendors.length) + pct(vendorsAssessed, vendors.length)) / 2,
        );

  const managementReadiness =
    (membersRes.data ?? []).length === 0
      ? 0
      : pct(
          Math.min((trainingRes.data ?? []).length, (membersRes.data ?? []).length),
          (membersRes.data ?? []).length,
        );

  const incidentControls = controls.filter((c) => c.area === "incident_management");
  const incidentControlsDone = incidentControls.filter(
    (c) => c.status === "approved",
  ).length;
  const incidentReadiness = Math.round(
    (pct(incidentRolesAssigned, incidentRoles.length) +
      pct(incidentControlsDone, Math.max(incidentControls.length, 1))) /
      2,
  );

  const nis2Readiness = pct(done, controls.length);
  const supervisoryReadiness = Math.round(
    (nis2Readiness +
      reportingReadiness +
      pct(controls.length - missingEvidence, Math.max(controls.length, 1))) /
      3,
  );

  return {
    nis2Readiness,
    reportingReadiness,
    supervisoryReadiness,
    managementReadiness,
    supplierReadiness,
    incidentReadiness,
    controlsTotal: controls.length,
    controlsApproved: done,
    controlsOverdue: overdue,
    controlsMissingEvidence: missingEvidence,
  };
}

/** Computes live data-quality warnings (spec §29). */
export async function computeDataQualityWarnings(
  tenantId: string,
): Promise<DataQualityWarning[]> {
  const admin = getAdminClient();

  const [rulesRes, servicesRes, systemsRes, vendorsRes, rolesRes, controlsRes] =
    await Promise.all([
      admin.from("data_quality_rules").select("*"),
      admin
        .from("critical_services")
        .select("id, service_owner_name, service_owner_user_id")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null),
      admin
        .from("systems")
        .select("id, owner_name, owner_user_id, vendor_id, hosting_model, rto_hours, rpo_hours, sector_critical, backup_status, personal_data")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null),
      admin
        .from("vendors")
        .select("id, incident_contact_name, incident_contact_email")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null),
      admin
        .from("role_assignments")
        .select("roles(code)")
        .eq("tenant_id", tenantId)
        .eq("status", "active"),
      admin
        .from("controls")
        .select("id, status, evidence_required, evidence_uploaded")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null),
    ]);

  const ruleMap = new Map((rulesRes.data ?? []).map((r) => [r.code, r]));
  type RoleRow = { roles: { code: string } | null };
  const roleCodes = new Set(
    ((rolesRes.data ?? []) as unknown as RoleRow[])
      .map((r) => r.roles?.code)
      .filter(Boolean) as string[],
  );

  const counts: Record<string, number> = {
    critical_service_missing_owner: (servicesRes.data ?? []).filter(
      (s) => !s.service_owner_name && !s.service_owner_user_id,
    ).length,
    system_missing_vendor: (systemsRes.data ?? []).filter(
      (s) =>
        !s.vendor_id &&
        (s.hosting_model === "saas" || s.hosting_model === "outsourced"),
    ).length,
    rto_rpo_missing: (systemsRes.data ?? []).filter(
      (s) => s.sector_critical && (s.rto_hours === null || s.rpo_hours === null),
    ).length,
    critical_system_missing_backup: (systemsRes.data ?? []).filter(
      (s) => s.sector_critical && s.backup_status !== "ok",
    ).length,
    vendor_missing_incident_contact: (vendorsRes.data ?? []).filter(
      (v) => !v.incident_contact_name && !v.incident_contact_email,
    ).length,
    ciso_not_assigned: roleCodes.has("ciso") ? 0 : 1,
    dpo_not_assigned:
      !roleCodes.has("dpo") &&
      (systemsRes.data ?? []).some((s) => s.personal_data)
        ? 1
        : 0,
    approved_control_missing_evidence: (controlsRes.data ?? []).filter(
      (c) => c.status === "approved" && c.evidence_required && !c.evidence_uploaded,
    ).length,
  };

  const warnings: DataQualityWarning[] = [];
  for (const [code, count] of Object.entries(counts)) {
    if (count === 0) continue;
    const rule = ruleMap.get(code);
    warnings.push({
      ruleCode: code,
      titleSv: rule?.title_sv ?? code,
      severity: (rule?.severity ?? "warning") as DataQualityWarning["severity"],
      count,
      linkPath: rule?.link_path ?? null,
    });
  }
  return warnings.sort((a, b) =>
    a.severity === b.severity ? b.count - a.count : a.severity === "critical" ? -1 : 1,
  );
}
