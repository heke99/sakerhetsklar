import { z } from "zod";

import { withApi, ok, parseBody, forbidden, notFound } from "@/lib/api/handler";
import { hasPermission, isTenantMember } from "@/lib/authz/context";
import { getTenantDataPlaneClient } from "@/lib/server/data-plane";
import { writeAuditLog } from "@/lib/audit/log";

export const GET = withApi<{ id: string }>(async (req, { actor, params }) => {
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  if (!tenantId) throw notFound("tenantId is required");
  if (!isTenantMember(actor, tenantId)) throw forbidden();

  const admin = await getTenantDataPlaneClient(tenantId);
  const { data, error } = await admin
    .from("late_reporting_records")
    .select("*")
    .eq("incident_id", params.id)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ok(data);
});

const updateSchema = z.object({
  tenantId: z.string().uuid(),
  recordId: z.string().uuid(),
  whyLate: z.string().max(5000).optional(),
  whoKnewWhat: z.string().max(5000).optional(),
  whyNotIdentifiedEarlier: z.string().max(5000).optional(),
  whyNotSent: z.string().max(5000).optional(),
  preventionActions: z.string().max(5000).optional(),
  approve: z.boolean().optional(),
});

export const PATCH = withApi<{ id: string }>(async (req, { actor, params }) => {
  const input = await parseBody(req, updateSchema);
  if (!hasPermission(actor, input.tenantId, "incidents.write")) {
    throw forbidden("incidents.write permission required");
  }

  const admin = await getTenantDataPlaneClient(input.tenantId);
  const { data: record } = await admin
    .from("late_reporting_records")
    .select("*")
    .eq("id", input.recordId)
    .eq("tenant_id", input.tenantId)
    .eq("incident_id", params.id)
    .maybeSingle();
  if (!record) throw notFound("Late reporting record not found");

  const update: Record<string, unknown> = {};
  if (input.whyLate !== undefined) update.why_late = input.whyLate;
  if (input.whoKnewWhat !== undefined) update.who_knew_what = input.whoKnewWhat;
  if (input.whyNotIdentifiedEarlier !== undefined) {
    update.why_not_identified_earlier = input.whyNotIdentifiedEarlier;
  }
  if (input.whyNotSent !== undefined) update.why_not_sent = input.whyNotSent;
  if (input.preventionActions !== undefined) update.prevention_actions = input.preventionActions;

  // Generate the explanation drafts from the structured answers.
  const answers = { ...record, ...update } as Record<string, string | null>;
  if (
    input.whyLate !== undefined ||
    input.whoKnewWhat !== undefined ||
    input.whyNotSent !== undefined ||
    input.preventionActions !== undefined
  ) {
    update.explanation_draft = buildExplanationDraft(answers);
    update.supervisory_explanation_draft = buildSupervisoryDraft(answers);
    update.status = "explanation_drafted";
  }

  if (input.approve) {
    if (!hasPermission(actor, input.tenantId, "incidents.approve")) {
      throw forbidden("incidents.approve permission required to approve the explanation");
    }
    update.status = "approved";
    update.approved_by = actor.userId;
    update.approved_at = new Date().toISOString();
  }

  const { data, error } = await admin
    .from("late_reporting_records")
    .update(update)
    .eq("id", input.recordId)
    .select()
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: input.approve ? "late_report.explanation_approved" : "late_report.explanation_updated",
    entityType: "late_reporting_record",
    entityId: input.recordId,
    newValue: { status: update.status },
  });

  return ok(data);
});

function buildExplanationDraft(a: Record<string, string | null>): string {
  return [
    "Intern förklaring — sen rapportering",
    "",
    `Deadline: ${a.deadline_type} (${a.due_at ? new Date(a.due_at as string).toLocaleString("sv-SE") : "-"})`,
    "",
    `Varför blev rapporten sen: ${a.why_late ?? "-"}`,
    `När upptäcktes incidenten: ${a.first_detected_at ? new Date(a.first_detected_at as string).toLocaleString("sv-SE") : "-"}`,
    `När var den känd internt: ${a.known_internally_at ? new Date(a.known_internally_at as string).toLocaleString("sv-SE") : "-"}`,
    `När identifierades den som betydande: ${a.identified_significant_at ? new Date(a.identified_significant_at as string).toLocaleString("sv-SE") : "-"}`,
    `Vem visste vad och när: ${a.who_knew_what ?? "-"}`,
    `Varför identifierades inte betydelsen tidigare: ${a.why_not_identified_earlier ?? "-"}`,
    `Varför skickades inte rapporten: ${a.why_not_sent ?? "-"}`,
    `Åtgärder för att förhindra upprepning: ${a.prevention_actions ?? "-"}`,
  ].join("\n");
}

function buildSupervisoryDraft(a: Record<string, string | null>): string {
  return [
    "Förklaring till tillsynsmyndighet — försenad rapportering",
    "",
    "Organisationen rapporterade incidenten senare än föreskriven tidsfrist. " +
      "Nedan redovisas orsaker och vidtagna åtgärder.",
    "",
    `Orsak till förseningen: ${a.why_late ?? "-"}`,
    `Tidslinje: upptäckt ${a.first_detected_at ? new Date(a.first_detected_at as string).toLocaleString("sv-SE") : "-"}, ` +
      `identifierad som betydande ${a.identified_significant_at ? new Date(a.identified_significant_at as string).toLocaleString("sv-SE") : "-"}.`,
    `Varför betydelsen inte identifierades tidigare: ${a.why_not_identified_earlier ?? "-"}`,
    `Åtgärder för att förhindra upprepning: ${a.prevention_actions ?? "-"}`,
    "",
    "Organisationen är medveten om att försenad rapportering kan utgöra en allvarlig " +
      "överträdelse och kan medföra tillsynsåtgärder. Åtgärdsplanen följs upp av ledningen.",
  ].join("\n");
}
