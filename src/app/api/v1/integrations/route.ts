import { z } from "zod";

import { withApi, ok, parseBody, forbidden, notFound } from "@/lib/api/handler";
import { hasTenantRole } from "@/lib/authz/context";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { writeAuditLog } from "@/lib/audit/log";

export const GET = withApi(async (req, { actor }) => {
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  if (!tenantId) throw notFound("tenantId is required");
  if (!hasTenantRole(actor, tenantId, ["tenant_admin", "ciso"])) throw forbidden();

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("integrations")
    .select("id, integration_type, name, status, config, last_sync_at, last_error, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ok(data);
});

const createSchema = z.object({
  tenantId: z.string().uuid(),
  integrationType: z.enum([
    "teams", "email_intake", "webhook", "entra_id", "saml", "oidc",
    "defender", "sentinel", "splunk", "elastic", "servicenow", "jira",
    "intune", "azure_resource_graph", "aws_security_hub", "google_workspace",
    "slack", "bankid", "soc_portal", "vendor_portal",
  ]),
  name: z.string().min(1).max(200),
  // Non-secret config only. Secrets are provided as env/secret-manager
  // references and stored in secret_refs.
  config: z.record(z.string(), z.unknown()).default({}),
  secretRefs: z.record(z.string(), z.string()).default({}),
});

export const POST = withApi(async (req, { actor }) => {
  const input = await parseBody(req, createSchema);
  if (!hasTenantRole(actor, input.tenantId, ["tenant_admin"])) {
    throw forbidden("Only tenant admins can configure integrations");
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("integrations")
    .insert({
      tenant_id: input.tenantId,
      integration_type: input.integrationType,
      name: input.name,
      config: input.config,
      secret_refs: input.secretRefs,
      status: "pending_setup",
      created_by: actor.userId,
    })
    .select("id, integration_type, name, status, config, created_at")
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: "integration.created",
    entityType: "integration",
    entityId: data.id,
    newValue: { type: input.integrationType, name: input.name },
  });

  return ok(data, { status: 201 });
});
