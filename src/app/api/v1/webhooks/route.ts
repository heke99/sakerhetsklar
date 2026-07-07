import { z } from "zod";

import { withApi, ok, parseBody, forbidden, notFound } from "@/lib/api/handler";
import { hasTenantRole } from "@/lib/authz/context";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { writeAuditLog } from "@/lib/audit/log";
import { enqueueWebhookEvent } from "@/lib/services/webhooks";

export const GET = withApi(async (req, { actor }) => {
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  if (!tenantId) throw notFound("tenantId is required");
  if (!hasTenantRole(actor, tenantId, ["tenant_admin"])) throw forbidden();

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("webhooks")
    .select("id, url, events, status, created_at")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
  return ok(data);
});

const createSchema = z.object({
  tenantId: z.string().uuid(),
  url: z.string().url().max(2000),
  events: z.array(z.string()).default([]),
  signingSecretRef: z.string().max(200).optional(),
});

export const POST = withApi(async (req, { actor }) => {
  const input = await parseBody(req, createSchema);
  if (!hasTenantRole(actor, input.tenantId, ["tenant_admin"])) {
    throw forbidden("Only tenant admins can manage webhooks");
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("webhooks")
    .insert({
      tenant_id: input.tenantId,
      url: input.url,
      events: input.events,
      signing_secret_ref: input.signingSecretRef ?? null,
      created_by: actor.userId,
    })
    .select("id, url, events, status, created_at")
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: "webhook.created",
    entityType: "webhook",
    entityId: data.id,
    newValue: { url: input.url, events: input.events },
  });

  return ok(data, { status: 201 });
});

const testSchema = z.object({
  tenantId: z.string().uuid(),
});

export const PATCH = withApi(async (req, { actor }) => {
  const input = await parseBody(req, testSchema);
  if (!hasTenantRole(actor, input.tenantId, ["tenant_admin"])) throw forbidden();

  const enqueued = await enqueueWebhookEvent({
    tenantId: input.tenantId,
    eventType: "test.ping",
    payload: { message: "Testhändelse från Säkerhetsklar", sentBy: actor.email },
  });
  return ok({ enqueued });
});
