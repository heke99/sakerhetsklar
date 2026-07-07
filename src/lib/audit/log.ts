import "server-only";

import { getAdminClient } from "@/lib/server/supabase-admin";

export interface AuditEntry {
  tenantId?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Writes an audit log entry via the service role. Sensitive payloads must be
 * reduced by callers before logging — never log secrets, evidence content or
 * personal data breach content.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin.from("audit_logs").insert({
    tenant_id: entry.tenantId ?? null,
    actor_user_id: entry.actorUserId ?? null,
    actor_role: entry.actorRole ?? null,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    previous_value: entry.previousValue ?? null,
    new_value: entry.newValue ?? null,
    reason: entry.reason ?? null,
    ip_address: entry.ipAddress ?? null,
    user_agent: entry.userAgent ?? null,
  });
  if (error) {
    // Audit logging must never fail silently in production paths.
    console.error("audit_log_write_failed", { action: entry.action, error: error.message });
    throw new Error(`Audit log write failed for action ${entry.action}`);
  }
}
