import { withApi, forbidden, notFound } from "@/lib/api/handler";
import { hasPermission } from "@/lib/authz/context";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { writeAuditLog } from "@/lib/audit/log";
import { buildProcurementPackage } from "@/lib/exports/procurement";

export const GET = withApi(async (req, { actor, meta }) => {
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  if (!tenantId) throw notFound("tenantId is required");
  if (!hasPermission(actor, tenantId, "procurement.generate")) {
    throw forbidden("procurement.generate permission required");
  }

  const { buffer, fileName, manifest } = await buildProcurementPackage(tenantId);

  const admin = getAdminClient();
  await admin.from("audit_packages").insert({
    tenant_id: tenantId,
    package_type: "procurement",
    manifest,
    generated_by: actor.userId,
  });
  await writeAuditLog({
    tenantId,
    actorUserId: actor.userId,
    action: "procurement.package_generated",
    entityType: "audit_package",
    newValue: { fileName },
    ipAddress: meta.ipAddress,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
});
