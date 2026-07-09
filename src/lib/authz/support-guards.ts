import "server-only";

import { forbidden } from "@/lib/api/handler";
import { getAdminClient } from "@/lib/server/supabase-admin";

import type { ActorContext } from "./context";

/**
 * Support-access scope enforcement (batch 10).
 *
 * When an actor's ONLY relationship to a tenant is an approved support-access
 * grant (no membership), the grant's scope flags decide what they may do:
 *
 * - `include_evidence` — required for evidence content (downloads/uploads).
 * - `allow_export`     — required for exports/packages.
 * - `scope=read_write` — required for any write.
 *
 * Every evaluated support action is logged to `support_access_logs`.
 */

export interface SupportGrant {
  id: string;
  scope: "read_only" | "read_write";
  includeEvidence: boolean;
  allowExport: boolean;
}

/** Returns the active approved grant, or null when the actor is a member. */
export async function getActiveSupportGrant(
  actor: ActorContext,
  tenantId: string,
): Promise<SupportGrant | null> {
  // Members are governed by their roles, not by support scopes.
  if (actor.tenantRoles.has(tenantId)) return null;
  if (!actor.supportAccessTenantIds.has(tenantId)) return null;

  const admin = getAdminClient();
  const { data } = await admin
    .from("support_access_requests")
    .select("id, scope, include_evidence, allow_export")
    .eq("requested_by", actor.userId)
    .eq("tenant_id", tenantId)
    .eq("status", "approved")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;

  return {
    id: data.id as string,
    scope: (data.scope as "read_only" | "read_write") ?? "read_only",
    includeEvidence: Boolean(data.include_evidence),
    allowExport: Boolean(data.allow_export),
  };
}

async function logSupportAction(
  grant: SupportGrant,
  actor: ActorContext,
  tenantId: string,
  action: string,
  entityType: string,
  entityId: string | null,
): Promise<void> {
  const admin = getAdminClient();
  await admin.from("support_access_logs").insert({
    tenant_id: tenantId,
    request_id: grant.id,
    actor_user_id: actor.userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
  });
}

export type SupportAction = "evidence_download" | "evidence_upload" | "export";

/**
 * Enforces the support grant's scope for the given action. No-op for tenant
 * members. Throws 403 when a support-only actor lacks the required flag.
 */
export async function assertSupportAccessAllows(
  actor: ActorContext,
  tenantId: string,
  action: SupportAction,
  entity?: { type: string; id: string | null },
): Promise<void> {
  const grant = await getActiveSupportGrant(actor, tenantId);
  if (!grant) return; // member (or unreachable non-member — route guards handle)

  if (
    (action === "evidence_download" || action === "evidence_upload") &&
    !grant.includeEvidence
  ) {
    await logSupportAction(
      grant,
      actor,
      tenantId,
      `denied:${action}`,
      entity?.type ?? "evidence",
      entity?.id ?? null,
    );
    throw forbidden(
      "Supportåtkomsten omfattar inte bevismaterial (include_evidence saknas).",
    );
  }
  if (action === "evidence_upload" && grant.scope !== "read_write") {
    await logSupportAction(
      grant,
      actor,
      tenantId,
      "denied:evidence_upload_read_only",
      entity?.type ?? "evidence",
      entity?.id ?? null,
    );
    throw forbidden("Supportåtkomsten är läsbehörighet — uppladdning tillåts inte.");
  }
  if (action === "export" && !grant.allowExport) {
    await logSupportAction(
      grant,
      actor,
      tenantId,
      "denied:export",
      entity?.type ?? "export",
      entity?.id ?? null,
    );
    throw forbidden("Supportåtkomsten omfattar inte export (allow_export saknas).");
  }

  await logSupportAction(
    grant,
    actor,
    tenantId,
    `allowed:${action}`,
    entity?.type ?? action,
    entity?.id ?? null,
  );
}
