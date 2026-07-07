import { z } from "zod";

import { withApi, ok, parseBody, forbidden, notFound } from "@/lib/api/handler";
import { hasPermission, isTenantMember } from "@/lib/authz/context";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { writeAuditLog } from "@/lib/audit/log";

export const GET = withApi(async (req, { actor }) => {
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  if (!tenantId) throw notFound("tenantId is required");
  if (!isTenantMember(actor, tenantId)) throw forbidden();

  const admin = getAdminClient();
  const [scenariosRes, runsRes] = await Promise.all([
    admin.from("exercise_scenarios").select("*").order("code"),
    admin
      .from("exercise_runs")
      .select("*, exercise_scenarios(title_sv), exercise_findings(*), exercise_action_plans(*)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
  ]);
  return ok({ scenarios: scenariosRes.data ?? [], runs: runsRes.data ?? [] });
});

const createSchema = z.object({
  tenantId: z.string().uuid(),
  scenarioCode: z.string(),
  participants: z.array(z.string()).default([]),
});

export const POST = withApi(async (req, { actor }) => {
  const input = await parseBody(req, createSchema);
  if (!hasPermission(actor, input.tenantId, "exercises.run")) {
    throw forbidden("exercises.run permission required");
  }

  const admin = getAdminClient();
  const { data: scenario } = await admin
    .from("exercise_scenarios")
    .select("id, code")
    .eq("code", input.scenarioCode)
    .maybeSingle();
  if (!scenario) throw notFound("Scenario not found");

  const { data, error } = await admin
    .from("exercise_runs")
    .insert({
      tenant_id: input.tenantId,
      scenario_id: scenario.id,
      participants: input.participants,
      status: "in_progress",
      started_at: new Date().toISOString(),
      created_by: actor.userId,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: "exercise.run_started",
    entityType: "exercise_run",
    entityId: data.id,
    newValue: { scenario: scenario.code },
  });

  return ok(data, { status: 201 });
});

const completeSchema = z.object({
  tenantId: z.string().uuid(),
  runId: z.string().uuid(),
  decisions: z.string().max(10000).optional(),
  minutesToClassify: z.number().int().min(0).optional(),
  minutesToDraftReport: z.number().int().min(0).optional(),
  missedSteps: z.string().max(5000).optional(),
  score: z.number().int().min(0).max(100).optional(),
  findings: z
    .array(z.object({ finding: z.string(), severity: z.enum(["low", "medium", "high"]) }))
    .default([]),
  actions: z
    .array(z.object({ action: z.string(), responsibleName: z.string().optional() }))
    .default([]),
});

export const PATCH = withApi(async (req, { actor }) => {
  const input = await parseBody(req, completeSchema);
  if (!hasPermission(actor, input.tenantId, "exercises.run")) {
    throw forbidden();
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("exercise_runs")
    .update({
      status: "completed",
      ended_at: new Date().toISOString(),
      decisions: input.decisions ?? null,
      minutes_to_classify: input.minutesToClassify ?? null,
      minutes_to_draft_report: input.minutesToDraftReport ?? null,
      missed_steps: input.missedSteps ?? null,
      score: input.score ?? null,
    })
    .eq("id", input.runId)
    .eq("tenant_id", input.tenantId)
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (input.findings.length > 0) {
    await admin.from("exercise_findings").insert(
      input.findings.map((f) => ({
        tenant_id: input.tenantId,
        exercise_run_id: input.runId,
        finding: f.finding,
        severity: f.severity,
      })),
    );
  }
  if (input.actions.length > 0) {
    await admin.from("exercise_action_plans").insert(
      input.actions.map((a) => ({
        tenant_id: input.tenantId,
        exercise_run_id: input.runId,
        action: a.action,
        responsible_name: a.responsibleName ?? null,
      })),
    );
  }

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: "exercise.run_completed",
    entityType: "exercise_run",
    entityId: input.runId,
    newValue: { score: input.score },
  });

  return ok(data);
});
