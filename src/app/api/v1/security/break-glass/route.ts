import { z } from "zod";

import { withApi, ok, parseBody, forbidden } from "@/lib/api/handler";
import { hasPlatformRole, hasTenantRole } from "@/lib/authz/context";
import { endBreakGlass, startBreakGlass } from "@/lib/services/security";
import { assertEntitlement } from "@/lib/services/entitlements";

const startSchema = z.object({
  tenantId: z.string().uuid(),
  reason: z.string().min(10).max(2000),
  scope: z.enum(["tenant_read", "tenant_write"]).default("tenant_read"),
  durationMinutes: z.number().int().min(15).max(480).default(60),
});

export const POST = withApi(async (req, { actor }) => {
  const input = await parseBody(req, startSchema);
  // Break-glass is for tenant admins/CISO in emergencies, or platform security.
  if (
    !hasTenantRole(actor, input.tenantId, ["tenant_admin", "ciso"]) &&
    !hasPlatformRole(actor, ["platform_owner", "security_admin"])
  ) {
    throw forbidden("Break-glass requires tenant admin/CISO or platform security role");
  }
  await assertEntitlement(input.tenantId, "break_glass");
  const session = await startBreakGlass(actor, input);
  return ok(session, { status: 201 });
});

const endSchema = z.object({
  sessionId: z.string().uuid(),
});

export const PATCH = withApi(async (req, { actor }) => {
  const input = await parseBody(req, endSchema);
  const session = await endBreakGlass(actor, { sessionId: input.sessionId });
  return ok(session);
});
