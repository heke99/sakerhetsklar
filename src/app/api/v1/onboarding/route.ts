import { z } from "zod";

import { withApi, ok, parseBody, forbidden, requireTenantIdParam } from "@/lib/api/handler";
import { hasTenantRole, isTenantMember } from "@/lib/authz/context";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { writeAuditLog } from "@/lib/audit/log";

export const GET = withApi(async (req, { actor }) => {
  const tenantId = requireTenantIdParam(req);
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

const contactsSchema = z.object({
  tenantId: z.string().uuid(),
  incidentContactName: z.string().max(200).nullable().optional(),
  incidentContactEmail: z.string().email().nullable().optional(),
  reportingContactName: z.string().max(200).nullable().optional(),
  reportingContactEmail: z.string().email().nullable().optional(),
  managementOwnerName: z.string().max(200).nullable().optional(),
  dpoContactName: z.string().max(200).nullable().optional(),
  dpoContactEmail: z.string().email().nullable().optional(),
  ssoRequiredPreference: z.boolean().nullable().optional(),
  dataResidencyRequirement: z.string().max(500).nullable().optional(),
  deploymentModelPreference: z
    .enum(["multi_tenant", "single_tenant", "customer_owned"])
    .nullable()
    .optional(),
});

/** Saves structured onboarding contacts/requirements to tenant settings. */
export const PUT = withApi(async (req, { actor }) => {
  const input = await parseBody(req, contactsSchema);
  if (!hasTenantRole(actor, input.tenantId, ["tenant_admin", "ciso"])) {
    throw forbidden();
  }

  const admin = getAdminClient();
  const update: Record<string, unknown> = { tenant_id: input.tenantId };
  const map: [keyof typeof input, string][] = [
    ["incidentContactName", "incident_contact_name"],
    ["incidentContactEmail", "incident_contact_email"],
    ["reportingContactName", "reporting_contact_name"],
    ["reportingContactEmail", "reporting_contact_email"],
    ["managementOwnerName", "management_owner_name"],
    ["dpoContactName", "dpo_contact_name"],
    ["dpoContactEmail", "dpo_contact_email"],
    ["ssoRequiredPreference", "sso_required_preference"],
    ["dataResidencyRequirement", "data_residency_requirement"],
    ["deploymentModelPreference", "deployment_model_preference"],
  ];
  for (const [from, to] of map) {
    if (input[from] !== undefined) update[to] = input[from];
  }

  const { data, error } = await admin
    .from("tenant_settings")
    .upsert(update, { onConflict: "tenant_id" })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: "onboarding.contacts_updated",
    entityType: "tenant_settings",
    entityId: input.tenantId,
    newValue: Object.fromEntries(
      Object.entries(update).filter(([k]) => k !== "tenant_id"),
    ),
  });

  return ok(data);
});
