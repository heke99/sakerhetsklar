import { z } from "zod";

import { withApi, ok, parseBody, forbidden, notFound } from "@/lib/api/handler";
import { hasTenantRole, isTenantMember } from "@/lib/authz/context";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { writeAuditLog } from "@/lib/audit/log";

export const GET = withApi(async (req, { actor }) => {
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  if (!tenantId) throw notFound("tenantId is required");
  if (!isTenantMember(actor, tenantId)) throw forbidden();

  const admin = getAdminClient();
  const [stepsRes, progressRes, blockersRes] = await Promise.all([
    admin.from("onboarding_steps").select("*").order("sort_order"),
    admin.from("onboarding_progress").select("*").eq("tenant_id", tenantId),
    admin
      .from("onboarding_blockers")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("resolved", false),
  ]);

  return ok({
    steps: stepsRes.data ?? [],
    progress: progressRes.data ?? [],
    blockers: blockersRes.data ?? [],
  });
});

const updateSchema = z.object({
  tenantId: z.string().uuid(),
  stepKey: z.string(),
  status: z.enum(["not_started", "in_progress", "completed", "skipped", "blocked"]),
  data: z.record(z.string(), z.unknown()).optional(),
});

export const POST = withApi(async (req, { actor }) => {
  const input = await parseBody(req, updateSchema);
  if (!hasTenantRole(actor, input.tenantId, ["tenant_admin", "ciso"])) {
    throw forbidden();
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("onboarding_progress")
    .upsert(
      {
        tenant_id: input.tenantId,
        step_key: input.stepKey,
        status: input.status,
        data: input.data ?? {},
        completed_by: input.status === "completed" ? actor.userId : null,
        completed_at: input.status === "completed" ? new Date().toISOString() : null,
      },
      { onConflict: "tenant_id,step_key" },
    )
    .select()
    .single();
  if (error) throw new Error(error.message);

  // Recompute tenant-level onboarding status.
  const [{ data: steps }, { data: progress }] = await Promise.all([
    admin.from("onboarding_steps").select("step_key, required"),
    admin
      .from("onboarding_progress")
      .select("step_key, status")
      .eq("tenant_id", input.tenantId),
  ]);
  const requiredSteps = (steps ?? []).filter((s) => s.required).map((s) => s.step_key);
  const completed = new Set(
    (progress ?? []).filter((p) => p.status === "completed").map((p) => p.step_key),
  );
  const allDone = requiredSteps.every((k) => completed.has(k));
  const anyStarted = (progress ?? []).some((p) => p.status !== "not_started");
  const anyBlocked = (progress ?? []).some((p) => p.status === "blocked");

  await admin
    .from("tenants")
    .update({
      onboarding_status: allDone
        ? "complete"
        : anyBlocked
          ? "blocked"
          : anyStarted
            ? "in_progress"
            : "not_started",
    })
    .eq("id", input.tenantId);

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: "onboarding.step_updated",
    entityType: "onboarding_progress",
    entityId: data.id,
    newValue: { stepKey: input.stepKey, status: input.status },
  });

  return ok(data);
});
