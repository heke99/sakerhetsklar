import { z } from "zod";

import { withApi, ok, parseBody, forbidden, notFound } from "@/lib/api/handler";
import { hasPermission } from "@/lib/authz/context";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { writeAuditLog } from "@/lib/audit/log";

export const GET = withApi(async () => {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("lathunds")
    .select("*, lathund_steps(*)")
    .eq("status", "active")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return ok(data);
});

const startSchema = z.object({
  tenantId: z.string().uuid(),
  lathundCode: z.string(),
  incidentId: z.string().uuid().optional(),
});

export const POST = withApi(async (req, { actor }) => {
  const input = await parseBody(req, startSchema);
  if (!hasPermission(actor, input.tenantId, "lathunds.run")) {
    throw forbidden("lathunds.run permission required");
  }

  const admin = getAdminClient();
  const { data: lathund } = await admin
    .from("lathunds")
    .select("id, code, title_sv")
    .eq("code", input.lathundCode)
    .maybeSingle();
  if (!lathund) throw notFound("Lathund not found");

  const { data: run, error } = await admin
    .from("lathund_runs")
    .insert({
      tenant_id: input.tenantId,
      lathund_id: lathund.id,
      incident_id: input.incidentId ?? null,
      started_by: actor.userId,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: "lathund.run_started",
    entityType: "lathund_run",
    entityId: run.id,
    newValue: { lathund: lathund.code },
  });

  return ok(run, { status: 201 });
});

const stepSchema = z.object({
  tenantId: z.string().uuid(),
  runId: z.string().uuid(),
  stepId: z.string().uuid(),
  completed: z.boolean(),
  answers: z.record(z.string(), z.unknown()).optional(),
});

export const PATCH = withApi(async (req, { actor }) => {
  const input = await parseBody(req, stepSchema);
  if (!hasPermission(actor, input.tenantId, "lathunds.run")) {
    throw forbidden();
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("lathund_run_steps")
    .upsert(
      {
        tenant_id: input.tenantId,
        run_id: input.runId,
        step_id: input.stepId,
        completed: input.completed,
        completed_by: input.completed ? actor.userId : null,
        completed_at: input.completed ? new Date().toISOString() : null,
        answers: input.answers ?? {},
      },
      { onConflict: "run_id,step_id" },
    )
    .select()
    .single();
  if (error) throw new Error(error.message);

  // Auto-complete the run when all steps are completed.
  const { data: run } = await admin
    .from("lathund_runs")
    .select("id, lathund_id")
    .eq("id", input.runId)
    .maybeSingle();
  if (run) {
    const [{ count: total }, { count: done }] = await Promise.all([
      admin
        .from("lathund_steps")
        .select("id", { count: "exact", head: true })
        .eq("lathund_id", run.lathund_id),
      admin
        .from("lathund_run_steps")
        .select("id", { count: "exact", head: true })
        .eq("run_id", input.runId)
        .eq("completed", true),
    ]);
    if (total !== null && done !== null && total > 0 && done >= total) {
      await admin
        .from("lathund_runs")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", input.runId);
    }
  }

  return ok(data);
});
