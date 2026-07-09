import { z } from "zod";

import { withApi, ok, parseBody, forbidden, notFound, requireTenantIdParam } from "@/lib/api/handler";
import { hasPermission, isTenantMember } from "@/lib/authz/context";
import { getTenantDataPlaneClient } from "@/lib/server/data-plane";
import { writeAuditLog } from "@/lib/audit/log";
import {
  computeReadiness,
  ensureControlsInstantiated,
} from "@/lib/services/readiness";

export const GET = withApi(async (req, { actor }) => {
  const tenantId = requireTenantIdParam(req);
  if (!isTenantMember(actor, tenantId)) throw forbidden();

  await ensureControlsInstantiated(tenantId);

  const admin = await getTenantDataPlaneClient(tenantId);
  const [controlsRes, readiness] = await Promise.all([
    admin
      .from("controls")
      .select("*")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("code"),
    computeReadiness(tenantId),
  ]);
  if (controlsRes.error) throw new Error(controlsRes.error.message);
  return ok({ controls: controlsRes.data ?? [], readiness });
});

const updateSchema = z.object({
  tenantId: z.string().uuid(),
  controlId: z.string().uuid(),
  status: z
    .enum([
      "not_started", "in_progress", "evidence_required", "ready_for_review",
      "approved", "overdue", "risk_accepted", "not_applicable",
    ])
    .optional(),
  assignedUserName: z.string().max(200).optional(),
  riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
  deadline: z.string().date().nullable().optional(),
  comments: z.string().max(5000).optional(),
});

export const PATCH = withApi(async (req, { actor }) => {
  const input = await parseBody(req, updateSchema);
  if (!hasPermission(actor, input.tenantId, "controls.write")) {
    throw forbidden("controls.write permission required");
  }
  if (input.status === "approved" && !hasPermission(actor, input.tenantId, "controls.approve")) {
    throw forbidden("controls.approve permission required to approve");
  }

  const admin = await getTenantDataPlaneClient(input.tenantId);
  const { data: previous } = await admin
    .from("controls")
    .select("status, assigned_user_name")
    .eq("id", input.controlId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (!previous) throw notFound("Control not found");

  const update: Record<string, unknown> = { updated_by: actor.userId };
  if (input.status !== undefined) {
    update.status = input.status;
    if (input.status === "approved") {
      update.approved_by = actor.userId;
      update.approved_at = new Date().toISOString();
      update.last_reviewed_at = new Date().toISOString();
    }
  }
  if (input.assignedUserName !== undefined) update.assigned_user_name = input.assignedUserName;
  if (input.riskLevel !== undefined) update.risk_level = input.riskLevel;
  if (input.deadline !== undefined) update.deadline = input.deadline;
  if (input.comments !== undefined) update.comments = input.comments;

  const { data, error } = await admin
    .from("controls")
    .update(update)
    .eq("id", input.controlId)
    .eq("tenant_id", input.tenantId)
    .select()
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: input.status === "approved" ? "control.approved" : "control.updated",
    entityType: "control",
    entityId: input.controlId,
    previousValue: previous,
    newValue: update,
  });

  return ok(data);
});
