import { z } from "zod";

import { withApi, ok, parseBody, forbidden, notFound } from "@/lib/api/handler";
import { isTenantMember } from "@/lib/authz/context";
import { getEvidenceDownloadUrl } from "@/lib/services/evidence";

const downloadSchema = z.object({
  tenantId: z.string().uuid(),
  reason: z.string().max(1000).optional(),
});

export const POST = withApi<{ id: string }>(async (req, { actor, params, meta }) => {
  const input = await parseBody(req, downloadSchema);
  if (!isTenantMember(actor, input.tenantId)) throw forbidden();

  try {
    const result = await getEvidenceDownloadUrl(actor, {
      tenantId: input.tenantId,
      evidenceId: params.id,
      reason: input.reason,
      ipAddress: meta.ipAddress,
    });
    return ok(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Download failed";
    if (message.includes("not found")) throw notFound(message);
    throw forbidden(message);
  }
});
