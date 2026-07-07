import { z } from "zod";

import { withApi, ok, parseBody, forbidden } from "@/lib/api/handler";
import { hasPlatformRole, hasTenantRole } from "@/lib/authz/context";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { writeAuditLog } from "@/lib/audit/log";
import { normalizeHost } from "@/lib/tenant-resolver/resolve";
import { clearResolverCache } from "@/lib/tenant-resolver/service";

export const GET = withApi<{ id: string }>(async (_req, { actor, params }) => {
  if (
    !hasPlatformRole(actor, ["platform_owner", "platform_admin", "deployment_admin"]) &&
    !hasTenantRole(actor, params.id, ["tenant_admin"])
  ) {
    throw forbidden();
  }
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("tenant_domains")
    .select("id, domain, environment, is_primary, status, verified_at, created_at")
    .eq("tenant_id", params.id)
    .order("created_at");
  if (error) throw new Error(error.message);
  return ok(data);
});

const createSchema = z.object({
  domain: z.string().min(3).max(253),
  environment: z.enum(["test", "stage", "prod"]).default("prod"),
  isPrimary: z.boolean().default(false),
});

export const POST = withApi<{ id: string }>(async (req, { actor, params, meta }) => {
  if (!hasPlatformRole(actor, ["platform_owner", "platform_admin", "deployment_admin"])) {
    throw forbidden("Domain registration is a platform operation");
  }
  const input = await parseBody(req, createSchema);

  const normalized = normalizeHost(input.domain);
  if (!normalized) {
    throw forbidden("Invalid domain");
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("tenant_domains")
    .insert({
      tenant_id: params.id,
      domain: normalized,
      environment: input.environment,
      is_primary: input.isPrimary,
      status: "active",
      created_by: actor.userId,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  clearResolverCache();

  await writeAuditLog({
    tenantId: params.id,
    actorUserId: actor.userId,
    action: "tenant.domain_registered",
    entityType: "tenant_domain",
    entityId: data.id,
    newValue: { domain: normalized, environment: input.environment },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return ok(data, { status: 201 });
});
