import "server-only";

import { sendEmail, isEmailConfigured } from "@/lib/server/email";
import { env } from "@/lib/server/env";
import { getAdminClient } from "@/lib/server/supabase-admin";

import { enqueueWebhookEvent, sendTeamsNotification } from "./webhooks";

/**
 * Domain-event notification fan-out (batch 13):
 *
 * 1. In-app notifications (recipients resolved by tenant role).
 * 2. Tenant webhooks (HMAC-signed, delivered by the webhook job).
 * 3. Teams (if the tenant has an active Teams integration).
 * 4. E-mail to the recipients (if the e-mail provider is configured).
 *
 * All channels are best-effort and never block the domain operation —
 * failures are logged, the source transaction has already committed.
 */
export interface TenantEventInput {
  tenantId: string;
  eventType: string;
  title: string;
  body: string;
  severity?: "info" | "warning" | "critical";
  linkPath?: string;
  entityType?: string;
  entityId?: string;
  /** Tenant roles that should receive in-app/e-mail notifications. */
  notifyRoles?: string[];
  /** Payload for webhooks (no sensitive content — ids and metadata only). */
  webhookPayload?: Record<string, unknown>;
}

export async function notifyTenantEvent(input: TenantEventInput): Promise<void> {
  try {
    const admin = getAdminClient();
    const roles = input.notifyRoles ?? ["tenant_admin", "ciso", "incident_manager"];

    const { data: assignments } = await admin
      .from("role_assignments")
      .select("user_id, roles(code)")
      .eq("tenant_id", input.tenantId)
      .eq("status", "active");
    type Row = { user_id: string; roles: { code: string } | null };
    const recipients = [
      ...new Set(
        ((assignments ?? []) as unknown as Row[])
          .filter((a) => a.roles && roles.includes(a.roles.code))
          .map((a) => a.user_id),
      ),
    ];

    if (recipients.length > 0) {
      await admin.from("notifications").insert(
        recipients.map((userId) => ({
          tenant_id: input.tenantId,
          user_id: userId,
          type: input.eventType,
          severity: input.severity ?? "info",
          title: input.title,
          body: input.body,
          link_path: input.linkPath ?? null,
          entity_type: input.entityType ?? null,
          entity_id: input.entityId ?? null,
        })),
      );
    }

    await enqueueWebhookEvent({
      tenantId: input.tenantId,
      eventType: input.eventType,
      payload: input.webhookPayload ?? {
        title: input.title,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
      },
    });

    await sendTeamsNotification({
      tenantId: input.tenantId,
      title: input.title,
      text: input.body,
    });

    if (isEmailConfigured() && recipients.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("user_id, email")
        .in("user_id", recipients);
      const link = input.linkPath ? `${env.appBaseUrl}${input.linkPath}` : env.appBaseUrl;
      await Promise.all(
        (profiles ?? [])
          .filter((p) => p.email)
          .map((p) =>
            sendEmail({
              to: p.email as string,
              subject: `Säkerhetsklar: ${input.title}`,
              text: `${input.body}\n\nÖppna i Säkerhetsklar: ${link}`,
            }),
          ),
      );
    }
  } catch (err) {
    // Notifications are best-effort; never break the calling flow.
    console.error("notify_tenant_event_failed", {
      eventType: input.eventType,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
