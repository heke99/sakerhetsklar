import "server-only";

import {
  getTenantControlPlaneClient,
  getTenantDataPlaneClient,
} from "@/lib/server/data-plane";
import { writeAuditLog } from "@/lib/audit/log";
import type { ActorContext } from "@/lib/authz/context";
import { loadRules } from "@/lib/rule-engine/service";
import { runSignificanceEngine } from "@/lib/significance/engine";
import { createDeadlinesForIncident } from "@/lib/services/deadlines";
import type { Facts } from "@/lib/rule-engine/types";

const PTS_SECTORS = [
  "digital_infrastructure",
  "digital_providers",
  "ict_b2b",
  "postal_courier",
  "space",
];

/**
 * Runs the significance assessment for an incident: combines tenant profile
 * facts, incident facts and manually supplied impact facts, evaluates the
 * tenant's assigned rule packages and persists the result.
 */
export async function assessIncidentSignificance(
  actor: ActorContext,
  input: { tenantId: string; incidentId: string; facts: Facts },
) {
  const admin = await getTenantDataPlaneClient(input.tenantId);
  const control = getTenantControlPlaneClient();

  const [incidentRes, scopeRes, packagesRes] = await Promise.all([
    admin
      .from("incidents")
      .select("*")
      .eq("id", input.incidentId)
      .eq("tenant_id", input.tenantId)
      .maybeSingle(),
    admin
      .from("scope_results")
      .select("*")
      .eq("tenant_id", input.tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    control
      .from("tenant_rule_package_versions")
      .select("rule_set_code, version")
      .eq("tenant_id", input.tenantId)
      .eq("status", "active"),
  ]);

  const incident = incidentRes.data;
  if (!incident) throw new Error("Incident not found");
  const scope = scopeRes.data;

  const assignedPackages = (packagesRes.data ?? []).map((p) => p.rule_set_code);
  const ruleSetCodes =
    assignedPackages.length > 0
      ? assignedPackages
      : ["MCFFS_2026_8", "GDPR_PERSONAL_DATA_BREACH", "CONTRACTUAL_REPORTING", "CYBER_INSURANCE"];

  const { data: tenantRow } = await control
    .from("tenants")
    .select("organization_type")
    .eq("id", input.tenantId)
    .maybeSingle();

  const sectors: string[] = (scope?.sectors as string[] | undefined) ?? [];
  const primarySector = sectors[0];
  const subsectors: string[] = (scope?.subsectors as string[] | undefined) ?? [];

  const autoFacts: Facts = {
    entity_type: tenantRow?.organization_type ?? undefined,
    classification: scope?.classification ?? undefined,
    sectors,
    severity: incident.severity,
    is_pts_sector: sectors.some((s) => PTS_SECTORS.includes(s)),
    personal_data_possibly_affected:
      incident.personal_data_possibly_affected ?? undefined,
    suspected_malicious: incident.suspected_malicious ?? undefined,
    supplier_origin: incident.supplier_origin ?? undefined,
  };

  const facts: Facts = { ...autoFacts, ...input.facts };

  const rules = await loadRules(ruleSetCodes);
  const result = runSignificanceEngine(rules, facts, {
    sector: primarySector,
    subsector: subsectors[0],
    entityType: tenantRow?.organization_type ?? undefined,
    classification: scope?.classification ?? undefined,
  });

  // Persist assessment.
  await admin
    .from("incident_significance_assessments")
    .update({ approval_status: "superseded" })
    .eq("incident_id", input.incidentId)
    .eq("approval_status", "pending");

  const { data: assessment, error } = await admin
    .from("incident_significance_assessments")
    .insert({
      tenant_id: input.tenantId,
      incident_id: input.incidentId,
      facts,
      recommendation: result.recommendation,
      rule_coverage_partial: result.ruleCoveragePartial,
      also_assess_gdpr: result.alsoAssess.gdpr,
      also_assess_pts: result.alsoAssess.pts,
      also_assess_eidas: result.alsoAssess.eidas,
      also_assess_contracts: result.alsoAssess.contracts,
      also_assess_insurance: result.alsoAssess.insurance,
      also_assess_state_agency: result.alsoAssess.stateAgency,
      matched_rules: result.matchedRules,
      reasons: result.reasons,
      missing_facts: result.missingFacts,
      legal_references: result.legalReferences,
      confidence: result.confidence,
      required_approver_roles: result.requiredApproverRoles,
      next_steps: result.nextSteps,
      deadline_definitions: result.deadlineDefinitions,
      rule_package_versions: Object.fromEntries(
        (packagesRes.data ?? []).map((p) => [p.rule_set_code, p.version]),
      ),
      assessed_by: actor.userId,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  // Update incident summary + significant timestamp.
  const incidentUpdate: Record<string, unknown> = {
    significance_status: result.recommendation,
    updated_by: actor.userId,
  };
  if (
    (result.recommendation === "significant_reportable" ||
      result.recommendation === "manual_review_required") &&
    !incident.identified_as_significant_at
  ) {
    incidentUpdate.identified_as_significant_at = new Date().toISOString();
  }
  await admin.from("incidents").update(incidentUpdate).eq("id", input.incidentId);

  // Activate legal + SLA deadlines once the incident is identified as
  // significant (or requires review).
  if (incidentUpdate.identified_as_significant_at || incident.identified_as_significant_at) {
    await createDeadlinesForIncident({
      tenantId: input.tenantId,
      incidentId: input.incidentId,
      actorUserId: actor.userId,
    });
  }

  // Open parallel tracks.
  const tracks: { code: string; reason: string }[] = [];
  tracks.push({ code: "NIS2_CYBERPORTALEN", reason: "NIS2-bedömning genomförd." });
  if (result.alsoAssess.gdpr) tracks.push({ code: "GDPR_IMY", reason: "Personuppgifter kan vara berörda." });
  if (result.alsoAssess.eidas) tracks.push({ code: "EIDAS_PTS", reason: "Betrodda tjänster berörda." });
  if (result.alsoAssess.pts) tracks.push({ code: "PTS_DIGITAL", reason: "PTS-sektor berörd." });
  if (result.alsoAssess.contracts) tracks.push({ code: "CONTRACTUAL", reason: "Avtalskrav kan gälla." });
  if (result.alsoAssess.insurance) tracks.push({ code: "INSURANCE", reason: "Cyberförsäkring finns." });
  if (result.alsoAssess.stateAgency) tracks.push({ code: "STATE_AGENCY", reason: "Statlig myndighet." });

  for (const track of tracks) {
    await admin.from("incident_regulatory_tracks").upsert(
      {
        tenant_id: input.tenantId,
        incident_id: input.incidentId,
        track_code: track.code,
        reason: track.reason,
        opened_by: actor.userId,
      },
      { onConflict: "incident_id,track_code", ignoreDuplicates: true },
    );
  }

  await admin.from("incident_events").insert({
    tenant_id: input.tenantId,
    incident_id: input.incidentId,
    event_type: "assessment_run",
    title: `Betydande-bedömning: ${result.recommendation}`,
    detail: result.reasons.join(" "),
    created_by: actor.userId,
  });

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: "incident.significance_assessed",
    entityType: "incident_significance_assessment",
    entityId: assessment.id,
    newValue: {
      incidentId: input.incidentId,
      recommendation: result.recommendation,
      confidence: result.confidence,
      matchedRules: result.matchedRules.map((r) => r.ruleCode),
    },
  });

  return { assessment, result };
}

export async function approveSignificanceAssessment(
  actor: ActorContext,
  input: { tenantId: string; assessmentId: string; decision: "approved" | "rejected"; reason?: string },
) {
  const admin = await getTenantDataPlaneClient(input.tenantId);
  const { data: assessment } = await admin
    .from("incident_significance_assessments")
    .select("id, incident_id, recommendation")
    .eq("id", input.assessmentId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (!assessment) throw new Error("Assessment not found");

  const { data, error } = await admin
    .from("incident_significance_assessments")
    .update({
      approval_status: input.decision,
      approved_by: actor.userId,
      approved_at: new Date().toISOString(),
    })
    .eq("id", input.assessmentId)
    .select()
    .single();
  if (error) throw new Error(error.message);

  await admin.from("incident_decision_logs").insert({
    tenant_id: input.tenantId,
    incident_id: assessment.incident_id,
    decision: `Betydande-bedömning ${input.decision === "approved" ? "godkänd" : "avvisad"}: ${assessment.recommendation}`,
    reason: input.reason ?? null,
    approver_user_id: actor.userId,
  });

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: "incident.significance_decision",
    entityType: "incident_significance_assessment",
    entityId: input.assessmentId,
    newValue: { decision: input.decision },
    reason: input.reason ?? null,
  });

  return data;
}
