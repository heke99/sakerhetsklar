import "server-only";

import { createHmac } from "node:crypto";

import { getAdminClient } from "@/lib/server/supabase-admin";

/**
 * Signed webhook dispatch (spec §47). Payloads are signed with HMAC-SHA256
 * using the tenant webhook's secret (resolved from a secret reference).
 * Deliveries are queued in webhook_deliveries and retried by the job runner.
 */
export async function enqueueWebhookEvent(input: {
  tenantId: string;
  eventType: string;
  payload: Record<string, unknown>;
}): Promise<number> {
  const admin = getAdminClient();
  const { data: hooks } = await admin
    .from("webhooks")
    .select("id, events")
    .eq("tenant_id", input.tenantId)
    .eq("status", "active");

  const matching = (hooks ?? []).filter(
    (h) => h.events.length === 0 || h.events.includes(input.eventType),
  );
  if (matching.length === 0) return 0;

  await admin.from("webhook_deliveries").insert(
    matching.map((h) => ({
      tenant_id: input.tenantId,
      webhook_id: h.id,
      event_type: input.eventType,
      payload: input.payload,
    })),
  );
  return matching.length;
}

export function signWebhookPayload(secret: string, body: string, timestamp: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

const MAX_ATTEMPTS = 5;

export async function processWebhookDeliveries(): Promise<{ delivered: number; failed: number }> {
  const admin = getAdminClient();
  const { data: deliveries } = await admin
    .from("webhook_deliveries")
    .select("*, webhooks(url, signing_secret_ref, status)")
    .eq("status", "pending")
    .lt("attempts", MAX_ATTEMPTS)
    .limit(50);

  let delivered = 0;
  let failed = 0;

  for (const delivery of deliveries ?? []) {
    const hook = delivery.webhooks as unknown as {
      url: string;
      signing_secret_ref: string | null;
      status: string;
    } | null;
    if (!hook || hook.status !== "active") {
      await admin
        .from("webhook_deliveries")
        .update({ status: "failed", last_attempt_at: new Date().toISOString() })
        .eq("id", delivery.id);
      failed += 1;
      continue;
    }

    const body = JSON.stringify({
      id: delivery.id,
      event: delivery.event_type,
      createdAt: delivery.created_at,
      data: delivery.payload,
    });
    const timestamp = Date.now().toString();
    const secret = hook.signing_secret_ref
      ? (process.env[hook.signing_secret_ref] ?? "")
      : "";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Sakerhetsklar-Event": delivery.event_type,
      "X-Sakerhetsklar-Timestamp": timestamp,
    };
    if (secret) {
      headers["X-Sakerhetsklar-Signature"] = signWebhookPayload(secret, body, timestamp);
    }

    try {
      const res = await fetch(hook.url, { method: "POST", headers, body });
      const success = res.ok;
      await admin
        .from("webhook_deliveries")
        .update({
          status: success
            ? "delivered"
            : delivery.attempts + 1 >= MAX_ATTEMPTS
              ? "failed"
              : "pending",
          attempts: delivery.attempts + 1,
          last_attempt_at: new Date().toISOString(),
          response_status: res.status,
        })
        .eq("id", delivery.id);
      if (success) delivered += 1;
      else failed += 1;
    } catch {
      await admin
        .from("webhook_deliveries")
        .update({
          status: delivery.attempts + 1 >= MAX_ATTEMPTS ? "failed" : "pending",
          attempts: delivery.attempts + 1,
          last_attempt_at: new Date().toISOString(),
        })
        .eq("id", delivery.id);
      failed += 1;
    }
  }

  return { delivered, failed };
}

/** Teams notification via incoming webhook URL stored in integration config. */
export async function sendTeamsNotification(input: {
  tenantId: string;
  title: string;
  text: string;
}): Promise<boolean> {
  const admin = getAdminClient();
  const { data: integration } = await admin
    .from("integrations")
    .select("id, config")
    .eq("tenant_id", input.tenantId)
    .eq("integration_type", "teams")
    .eq("status", "active")
    .maybeSingle();
  if (!integration) return false;

  const config = integration.config as { webhook_url_ref?: string };
  const url = config.webhook_url_ref ? process.env[config.webhook_url_ref] : undefined;
  if (!url) return false;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        summary: input.title,
        title: input.title,
        text: input.text,
      }),
    });
    if (!res.ok) throw new Error(`Teams responded ${res.status}`);
    await admin
      .from("integrations")
      .update({ last_sync_at: new Date().toISOString(), last_error: null })
      .eq("id", integration.id);
    return true;
  } catch (err) {
    await admin
      .from("integrations")
      .update({ last_error: err instanceof Error ? err.message : "unknown" })
      .eq("id", integration.id);
    await admin.from("integration_error_logs").insert({
      tenant_id: input.tenantId,
      integration_id: integration.id,
      error: err instanceof Error ? err.message : "unknown",
    });
    return false;
  }
}
