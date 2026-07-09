import "server-only";

import { ApiError } from "@/lib/api/handler";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { writeAuditLog } from "@/lib/audit/log";
import type { ActorContext } from "@/lib/authz/context";
import { hasPlatformRole, hasTenantRole } from "@/lib/authz/context";

/** Break-glass (spec §6): reason, time limit, logging, admin notification. */
export async function startBreakGlass(
  actor: ActorContext,
  input: { tenantId: string; reason: string; scope: "tenant_read" | "tenant_write"; durationMinutes: number },
) {
  const admin = getAdminClient();
  const expiresAt = new Date(Date.now() + input.durationMinutes * 60_000).toISOString();

  const { data: session, error } = await admin
    .from("break_glass_sessions")
    .insert({
      tenant_id: input.tenantId,
      user_id: actor.userId,
      reason: input.reason,
      scope: input.scope,
      expires_at: expiresAt,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  // Notify tenant admins and security leads.
  const { data: assignments } = await admin
    .from("role_assignments")
    .select("user_id, roles(code)")
    .eq("tenant_id", input.tenantId)
    .eq("status", "active");
  type Row = { user_id: string; roles: { code: string } | null };
  const recipients = ((assignments ?? []) as unknown as Row[])
    .filter((a) => a.roles && ["tenant_admin", "ciso"].includes(a.roles.code))
    .map((a) => a.user_id);
  if (recipients.length > 0) {
    await admin.from("notifications").insert(
      recipients.map((userId) => ({
        tenant_id: input.tenantId,
        user_id: userId,
        type: "break_glass_started",
        severity: "critical",
        title: "Break-glass-åtkomst startad",
        body: `Nödåtkomst startad. Skäl: ${input.reason}. Gäller till ${new Date(expiresAt).toLocaleString("sv-SE")}.`,
        link_path: "/app/access-review",
        entity_type: "break_glass_session",
        entity_id: session.id,
      })),
    );
  }

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: "break_glass.started",
    entityType: "break_glass_session",
    entityId: session.id,
    newValue: { scope: input.scope, expiresAt },
    reason: input.reason,
  });

  return session;
}

export async function endBreakGlass(
  actor: ActorContext,
  input: { sessionId: string },
) {
  const admin = getAdminClient();

  // Resolve the session first: only the session owner, a tenant admin/CISO of
  // the session's tenant, or platform security may end it.
  const { data: existing, error: loadError } = await admin
    .from("break_glass_sessions")
    .select("id, tenant_id, user_id, status")
    .eq("id", input.sessionId)
    .maybeSingle();
  if (loadError) throw new Error(loadError.message);
  if (!existing) throw new ApiError(404, "Resource not found", "not_found");

  const isOwner = existing.user_id === actor.userId;
  const isTenantSecurity = hasTenantRole(actor, existing.tenant_id, [
    "tenant_admin",
    "ciso",
  ]);
  const isPlatformSecurity = hasPlatformRole(actor, [
    "platform_owner",
    "security_admin",
  ]);
  if (!isOwner && !isTenantSecurity && !isPlatformSecurity) {
    // 404 so a foreign session id cannot be probed for existence.
    throw new ApiError(404, "Resource not found", "not_found");
  }

  const { data: session, error } = await admin
    .from("break_glass_sessions")
    .update({ status: "ended", ended_at: new Date().toISOString(), ended_by: actor.userId })
    .eq("id", input.sessionId)
    .select()
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    tenantId: session.tenant_id,
    actorUserId: actor.userId,
    action: "break_glass.ended",
    entityType: "break_glass_session",
    entityId: session.id,
  });

  return session;
}

interface AnomalyRule {
  code: string;
  category: "security" | "privacy";
  severity: string;
  params: { threshold?: number; window_hours?: number; start_hour?: number; end_hour?: number };
}

/**
 * Anomaly scan (spec §38): evaluates seeded rules against access/export/
 * download/audit logs and creates anomaly events + review cases. Idempotent
 * per (rule, actor, window) via existence checks.
 */
export async function runAnomalyScan(now = new Date()): Promise<{ eventsCreated: number }> {
  const admin = getAdminClient();
  const { data: rules } = await admin
    .from("security_anomaly_rules")
    .select("*")
    .eq("status", "active");

  let eventsCreated = 0;

  for (const rule of (rules ?? []) as unknown as AnomalyRule[]) {
    const windowHours = rule.params.window_hours ?? 24;
    const threshold = rule.params.threshold ?? 10;
    const since = new Date(now.getTime() - windowHours * 3600_000).toISOString();

    let counts: Map<string, { tenantId: string | null; count: number; detail: string }> | null =
      null;

    if (rule.code === "unusual_evidence_views" || rule.code === "mass_downloads") {
      const action = rule.code === "mass_downloads" ? "downloaded" : "viewed";
      const { data } = await admin
        .from("evidence_access_logs")
        .select("actor_user_id, tenant_id")
        .gte("created_at", since)
        .eq("action", rule.code === "mass_downloads" ? action : "downloaded");
      counts = countBy(data ?? [], `${rule.code}`);
    } else if (rule.code === "repeated_restricted_access") {
      const { data } = await admin
        .from("evidence_access_logs")
        .select("actor_user_id, tenant_id, reason")
        .gte("created_at", since)
        .not("reason", "is", null);
      counts = countBy(data ?? [], "restricted access");
    } else if (rule.code === "large_export_attempts") {
      const { data } = await admin
        .from("export_logs")
        .select("actor_user_id, tenant_id")
        .gte("created_at", since);
      counts = countBy(data ?? [], "exports");
    } else if (rule.code === "repeated_role_changes") {
      const { data } = await admin
        .from("audit_logs")
        .select("actor_user_id, tenant_id")
        .eq("action", "user.role_changed")
        .gte("created_at", since);
      counts = countBy(data ?? [], "role changes");
    } else if (rule.code === "break_glass_misuse") {
      const { data } = await admin
        .from("break_glass_sessions")
        .select("user_id, tenant_id")
        .gte("created_at", since);
      counts = countBy(
        (data ?? []).map((d) => ({ actor_user_id: d.user_id, tenant_id: d.tenant_id })),
        "break-glass sessions",
      );
    } else if (rule.code === "suspicious_submission_changes") {
      const { data } = await admin
        .from("audit_logs")
        .select("actor_user_id, tenant_id")
        .in("action", ["report.marked_submitted", "report.closed_without_cyberportal_id"])
        .gte("created_at", since);
      counts = countBy(data ?? [], "submission status changes");
    } else if (rule.code === "unusual_deletions") {
      const { data } = await admin
        .from("audit_logs")
        .select("actor_user_id, tenant_id")
        .ilike("action", "%delete%")
        .gte("created_at", since);
      counts = countBy(data ?? [], "deletions");
    }

    if (!counts) continue;

    for (const [actorId, info] of counts) {
      if (info.count < threshold) continue;

      const table =
        rule.category === "privacy" ? "privacy_anomaly_events" : "security_anomaly_events";

      // Idempotency: skip if an event for this rule+actor exists in the window.
      const { data: existing } = await admin
        .from(table)
        .select("id")
        .eq("rule_code", rule.code)
        .eq("actor_user_id", actorId)
        .gte("detected_at", since)
        .limit(1);
      if (existing && existing.length > 0) continue;

      const { data: event } = await admin
        .from(table)
        .insert({
          tenant_id: info.tenantId,
          rule_code: rule.code,
          actor_user_id: actorId,
          severity: rule.severity,
          detail: `${info.count} ${info.detail} inom ${windowHours}h (tröskel ${threshold}).`,
          evidence: { count: info.count, windowHours, threshold },
        })
        .select()
        .single();

      if (event) {
        await admin.from("anomaly_review_cases").insert({
          tenant_id: info.tenantId,
          anomaly_event_id: rule.category === "security" ? event.id : null,
          privacy_event_id: rule.category === "privacy" ? event.id : null,
        });
        eventsCreated += 1;
      }
    }
  }

  return { eventsCreated };
}

function countBy(
  rows: { actor_user_id: string | null; tenant_id: string | null }[],
  detail: string,
): Map<string, { tenantId: string | null; count: number; detail: string }> {
  const map = new Map<string, { tenantId: string | null; count: number; detail: string }>();
  for (const row of rows) {
    if (!row.actor_user_id) continue;
    const entry = map.get(row.actor_user_id) ?? {
      tenantId: row.tenant_id,
      count: 0,
      detail,
    };
    entry.count += 1;
    map.set(row.actor_user_id, entry);
  }
  return map;
}
