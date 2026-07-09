import { z } from "zod";

import { ApiError, withApi, ok, parseBody, forbidden, notFound } from "@/lib/api/handler";
import {
  hasPlatformRole,
  hasTenantRole,
  isPlatformAdmin,
  isTenantMember,
} from "@/lib/authz/context";
import { invalidateDataPlaneCache } from "@/lib/server/data-plane";
import {
  assertEntitlement,
  invalidateEntitlementsCache,
} from "@/lib/services/entitlements";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { writeAuditLog } from "@/lib/audit/log";

export const GET = withApi<{ id: string }>(async (_req, { actor, params }) => {
  if (!isPlatformAdmin(actor) && !isTenantMember(actor, params.id)) {
    throw forbidden();
  }
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("tenants")
    .select("*, tenant_settings(*)")
    .eq("id", params.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw notFound("Tenant not found");
  return ok(data);
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(["active", "paused", "disabled"]).optional(),
  plan: z.enum(["starter", "business", "enterprise"]).optional(),
  deploymentModel: z
    .enum(["multi_tenant", "single_tenant", "customer_owned"])
    .optional(),
  primaryContactName: z.string().max(200).nullable().optional(),
  primaryContactEmail: z.string().email().nullable().optional(),
});

export const PATCH = withApi<{ id: string }>(async (req, { actor, params }) => {
  const isPlatform = hasPlatformRole(actor, ["platform_owner", "platform_admin"]);
  const isTenantAdmin = hasTenantRole(actor, params.id, ["tenant_admin"]);
  if (!isPlatform && !isTenantAdmin) throw forbidden();

  const input = await parseBody(req, updateSchema);

  // Plan, status and deployment model changes are platform-level decisions.
  if ((input.plan || input.status || input.deploymentModel) && !isPlatform) {
    throw forbidden("Plan, status and deployment model are managed by the platform");
  }

  const admin = getAdminClient();
  const { data: previous } = await admin
    .from("tenants")
    .select("name, status, plan, deployment_model")
    .eq("id", params.id)
    .maybeSingle();
  if (!previous) throw notFound("Tenant not found");

  // Switching to Model B/C requires a fully provisioned data-plane
  // connection (active + resolvable secret). Without one the tenant would be
  // locked out by the fail-closed data-plane gate, so refuse the switch with
  // a clear reason instead of silently breaking the tenant.
  if (
    input.deploymentModel &&
    input.deploymentModel !== "multi_tenant" &&
    input.deploymentModel !== previous.deployment_model
  ) {
    // Model B/C is an entitlement-gated capability.
    await assertEntitlement(
      params.id,
      input.deploymentModel === "single_tenant"
        ? "single_tenant"
        : "customer_owned_data_plane",
    );
    const { data: connection } = await admin
      .from("tenant_data_plane_connections")
      .select("status, supabase_url, service_role_key_ref")
      .eq("tenant_id", params.id)
      .eq("environment", "prod")
      .maybeSingle();
    const secretConfigured = Boolean(
      connection?.service_role_key_ref &&
        process.env[connection.service_role_key_ref],
    );
    if (
      !connection ||
      connection.status !== "active" ||
      !connection.supabase_url ||
      !secretConfigured
    ) {
      throw new ApiError(
        409,
        "Deployment model B/C requires a provisioned, active data-plane connection with a configured server-side secret. Provision the data plane first.",
        "data_plane_not_ready",
      );
    }
  }

  const update: Record<string, unknown> = { updated_by: actor.userId };
  if (input.name !== undefined) update.name = input.name;
  if (input.status !== undefined) update.status = input.status;
  if (input.plan !== undefined) update.plan = input.plan;
  if (input.deploymentModel !== undefined) update.deployment_model = input.deploymentModel;
  if (input.primaryContactName !== undefined) update.primary_contact_name = input.primaryContactName;
  if (input.primaryContactEmail !== undefined) update.primary_contact_email = input.primaryContactEmail;

  const { data, error } = await admin
    .from("tenants")
    .update(update)
    .eq("id", params.id)
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (input.deploymentModel) invalidateDataPlaneCache(params.id);
  if (input.plan) invalidateEntitlementsCache(params.id);

  await writeAuditLog({
    tenantId: params.id,
    actorUserId: actor.userId,
    action: input.deploymentModel
      ? "tenant.deployment_model_changed"
      : "tenant.updated",
    entityType: "tenant",
    entityId: params.id,
    previousValue: previous,
    newValue: update,
  });

  return ok(data);
});

const deleteSchema = z.object({
  /** Must exactly match the tenant name — deliberate-intent confirmation. */
  confirmName: z.string().min(1),
  reason: z.string().min(10).max(2000),
});

/**
 * Tenant deletion (soft delete). Deliberate and audited:
 * - platform_owner only,
 * - requires typing the exact tenant name + a documented reason,
 * - BLOCKED while the tenant has active legal holds,
 * - data remains recoverable until purged per the retention runbook.
 */
export const DELETE = withApi<{ id: string }>(async (req, { actor, params }) => {
  if (!hasPlatformRole(actor, ["platform_owner"])) {
    throw forbidden("Only the platform owner can delete tenants");
  }
  const input = await parseBody(req, deleteSchema);

  const admin = getAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("id, name, status")
    .eq("id", params.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!tenant) throw notFound("Tenant not found");

  if (input.confirmName !== tenant.name) {
    throw new ApiError(
      422,
      "Bekräftelsen matchar inte organisationens namn.",
      "confirmation_mismatch",
    );
  }

  const { count: activeHolds } = await admin
    .from("legal_holds")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", params.id)
    .eq("status", "active");
  if ((activeHolds ?? 0) > 0) {
    throw new ApiError(
      409,
      `Organisationen har ${activeHolds} aktiv(a) legal hold(s). Radering är blockerad tills alla legal holds har släppts.`,
      "legal_hold_active",
    );
  }

  const { data, error } = await admin
    .from("tenants")
    .update({
      deleted_at: new Date().toISOString(),
      status: "disabled",
      updated_by: actor.userId,
    })
    .eq("id", params.id)
    .select("id, name, deleted_at")
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    tenantId: params.id,
    actorUserId: actor.userId,
    action: "tenant.deleted",
    entityType: "tenant",
    entityId: params.id,
    previousValue: { name: tenant.name, status: tenant.status },
    newValue: { deletedAt: data.deleted_at },
    reason: input.reason,
  });

  return ok(data);
});
