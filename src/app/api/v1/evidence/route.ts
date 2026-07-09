import { withApi, ok, badRequest, forbidden, notFound } from "@/lib/api/handler";
import { hasPermission, isTenantMember } from "@/lib/authz/context";
import { getTenantDataPlaneClient } from "@/lib/server/data-plane";
import { uploadEvidence } from "@/lib/services/evidence";

export const GET = withApi(async (req, { actor }) => {
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  if (!tenantId) throw notFound("tenantId is required");
  if (!isTenantMember(actor, tenantId)) throw forbidden();

  const admin = await getTenantDataPlaneClient(tenantId);
  let query = admin
    .from("evidence")
    .select("id, file_name, file_type, evidence_type, classification, hash_sha256, incident_id, control_id, legal_hold, uploaded_at, uploaded_by")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false });

  // Restricted evidence metadata only for privileged permission holders.
  if (!hasPermission(actor, tenantId, "evidence.restricted.read")) {
    query = query.in("classification", ["open", "internal", "confidential"]);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ok(data);
});

const CLASSIFICATIONS = [
  "open", "internal", "confidential", "strictly_confidential",
  "security_sensitive", "potentially_security_classified",
];

export const POST = withApi(async (req, { actor, meta }) => {
  const form = await req.formData().catch(() => null);
  if (!form) throw badRequest("multipart/form-data expected");

  const tenantId = String(form.get("tenantId") ?? "");
  const file = form.get("file");
  const classification = String(form.get("classification") ?? "internal");
  const evidenceType = String(form.get("evidenceType") ?? "other");
  const incidentId = form.get("incidentId") ? String(form.get("incidentId")) : undefined;
  const controlId = form.get("controlId") ? String(form.get("controlId")) : undefined;
  const source = form.get("source") ? String(form.get("source")) : undefined;
  const notes = form.get("chainOfCustodyNotes")
    ? String(form.get("chainOfCustodyNotes"))
    : undefined;

  if (!tenantId || !(file instanceof File)) throw badRequest("tenantId and file are required");
  if (!CLASSIFICATIONS.includes(classification)) throw badRequest("Invalid classification");
  if (!hasPermission(actor, tenantId, "evidence.write")) {
    throw forbidden("evidence.write permission required");
  }
  if (file.size > 50 * 1024 * 1024) throw badRequest("Max file size is 50 MB");

  const evidence = await uploadEvidence(actor, {
    tenantId,
    file,
    evidenceType,
    classification,
    incidentId,
    controlId,
    source,
    chainOfCustodyNotes: notes,
    ipAddress: meta.ipAddress,
  });

  return ok(evidence, { status: 201 });
});
