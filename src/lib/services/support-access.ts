import "server-only";

import { getAdminClient } from "@/lib/server/supabase-admin";
import { writeAuditLog } from "@/lib/audit/log";
import type { ActorContext } from "@/lib/authz/context";

/**
 * Support access lifecycle (spec §6): purpose-bound, time-limited, tenant
 * approved, fully logged and revocable. Evidence/export access only when
 * explicitly granted.
 */
export async function requestSupportAccess(
  actor: ActorContext,
  input: {
    tenantId: string;
    purpose: string;
    scope: "read_only" | "read_write";
    includeEvidence: boolean;
    allowExport: boolean;
    durationHours: number;
  },
) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("support_access_requests")
    .insert({
      tenant_id: input.tenantId,
      requested_by: actor.userId,
      purpose: input.purpose,
      scope: input.scope,
      include_evidence: input.includeEvidence,
      allow_export: input.allowExport,
      expires_at: new Date(Date.now() + input.durationHours * 3600_000).toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: "support_access.requested",
    entityType: "support_access_request",
    entityId: data.id,
    newValue: {
      purpose: input.purpose,
      scope: input.scope,
      includeEvidence: input.includeEvidence,
      allowExport: input.allowExport,
    },
  });

  return data;
}

export async function decideSupportAccess(
  actor: ActorContext,
  input: { requestId: string; decision: "approved" | "denied"; reason?: string },
) {
  const admin = getAdminClient();
  const { data: request } = await admin
    .from("support_access_requests")
    .select("*")
    .eq("id", input.requestId)
    .maybeSingle();
  if (!request) throw new Error("Support access request not found");
  if (request.status !== "requested") {
    throw new Error(`Request is already ${request.status}`);
  }

  const update =
    input.decision === "approved"
      ? { status: "approved", approved_by: actor.userId, approved_at: new Date().toISOString() }
      : { status: "denied", denied_by: actor.userId, denied_at: new Date().toISOString() };

  const { data, error } = await admin
    .from("support_access_requests")
    .update(update)
    .eq("id", input.requestId)
    .select()
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    tenantId: request.tenant_id,
    actorUserId: actor.userId,
    action: `support_access.${input.decision}`,
    entityType: "support_access_request",
    entityId: request.id,
    reason: input.reason ?? null,
  });

  return data;
}

export async function revokeSupportAccess(
  actor: ActorContext,
  input: { requestId: string; reason: string },
) {
  const admin = getAdminClient();
  const { data: request } = await admin
    .from("support_access_requests")
    .select("*")
    .eq("id", input.requestId)
    .maybeSingle();
  if (!request) throw new Error("Support access request not found");

  const { data, error } = await admin
    .from("support_access_requests")
    .update({
      status: "revoked",
      revoked_by: actor.userId,
      revoked_at: new Date().toISOString(),
    })
    .eq("id", input.requestId)
    .select()
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    tenantId: request.tenant_id,
    actorUserId: actor.userId,
    action: "support_access.revoked",
    entityType: "support_access_request",
    entityId: request.id,
    reason: input.reason,
  });

  return data;
}
