import "server-only";

import { createHash } from "node:crypto";

import { ApiError } from "@/lib/api/handler";
import { getTenantControlPlaneClient, getTenantDataPlaneClient } from "@/lib/server/data-plane";
import { writeAuditLog } from "@/lib/audit/log";
import type { ActorContext } from "@/lib/authz/context";
import { hasPermission } from "@/lib/authz/context";
import { assertSupportAccessAllows } from "@/lib/authz/support-guards";
import { assertTenantEntity } from "@/lib/authz/tenant-guards";
import { validateEvidenceFile } from "@/lib/evidence/file-policy";
import {
  isMalwareScanRequired,
  scanEvidenceFile,
} from "@/lib/evidence/malware-scan";

const RESTRICTED_CLASSIFICATIONS = [
  "strictly_confidential",
  "security_sensitive",
  "potentially_security_classified",
];

export async function uploadEvidence(
  actor: ActorContext,
  input: {
    tenantId: string;
    file: File;
    evidenceType: string;
    classification: string;
    incidentId?: string;
    controlId?: string;
    source?: string;
    chainOfCustodyNotes?: string;
    ipAddress?: string | null;
  },
) {
  const admin = await getTenantDataPlaneClient(input.tenantId);

  // Support-only actors need read_write scope + include_evidence.
  await assertSupportAccessAllows(actor, input.tenantId, "evidence_upload");

  // Linked entities must belong to the same tenant as the evidence.
  if (input.incidentId) {
    await assertTenantEntity("incidents", input.incidentId, input.tenantId);
  }
  if (input.controlId) {
    await assertTenantEntity("controls", input.controlId, input.tenantId);
  }

  // File policy: type allowlist/blocklist + plan-based size limit.
  const control = getTenantControlPlaneClient();
  const { data: tenantRow } = await control
    .from("tenants")
    .select("plan")
    .eq("id", input.tenantId)
    .maybeSingle();
  const policy = validateEvidenceFile({
    fileName: input.file.name,
    sizeBytes: input.file.size,
    plan: tenantRow?.plan ?? null,
  });
  if (!policy.ok) {
    throw new ApiError(422, policy.reasonSv, policy.code);
  }

  const bytes = Buffer.from(await input.file.arrayBuffer());

  // Malware scan hook: fail closed when scanning is required but the scanner
  // is unavailable; reject infected files outright.
  const scan = await scanEvidenceFile(bytes);
  if (scan.status === "infected") {
    await writeAuditLog({
      tenantId: input.tenantId,
      actorUserId: actor.userId,
      action: "evidence.upload_blocked_malware",
      entityType: "evidence",
      entityId: null,
      newValue: { fileName: input.file.name, detail: scan.detail },
    });
    throw new ApiError(422, "Filen stoppades av skadlig kod-kontrollen.", "malware_detected");
  }
  if (
    (scan.status === "unavailable" || scan.status === "skipped") &&
    isMalwareScanRequired()
  ) {
    throw new ApiError(
      503,
      "Skanning av skadlig kod krävs men är inte tillgänglig just nu. Försök igen senare.",
      "malware_scan_unavailable",
    );
  }
  const hash = createHash("sha256").update(bytes).digest("hex");
  const safeName = input.file.name.replace(/[^a-zA-Z0-9._åäöÅÄÖ-]/g, "_");
  const storagePath = `${input.tenantId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await admin.storage
    .from("evidence")
    .upload(storagePath, bytes, {
      contentType: input.file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) {
    throw new Error(`Evidence upload failed: ${uploadError.message}`);
  }

  const { data: evidence, error } = await admin
    .from("evidence")
    .insert({
      tenant_id: input.tenantId,
      incident_id: input.incidentId ?? null,
      control_id: input.controlId ?? null,
      file_name: input.file.name,
      file_type: input.file.type || null,
      file_size_bytes: bytes.length,
      evidence_type: input.evidenceType,
      classification: input.classification,
      storage_path: storagePath,
      hash_sha256: hash,
      source: input.source ?? null,
      chain_of_custody_notes: input.chainOfCustodyNotes ?? null,
      uploaded_by: actor.userId,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await Promise.all([
    admin.from("evidence_hashes").insert({
      tenant_id: input.tenantId,
      evidence_id: evidence.id,
      algorithm: "sha256",
      hash_value: hash,
    }),
    admin.from("evidence_versions").insert({
      tenant_id: input.tenantId,
      evidence_id: evidence.id,
      version: 1,
      storage_path: storagePath,
      hash_sha256: hash,
      uploaded_by: actor.userId,
    }),
    admin.from("evidence_chain_of_custody").insert({
      tenant_id: input.tenantId,
      evidence_id: evidence.id,
      event: "uploaded",
      detail: `Fil ${input.file.name} uppladdad (sha256: ${hash.slice(0, 16)}…)`,
      actor_user_id: actor.userId,
    }),
    admin.from("evidence_access_logs").insert({
      tenant_id: input.tenantId,
      evidence_id: evidence.id,
      action: "uploaded",
      actor_user_id: actor.userId,
      ip_address: input.ipAddress ?? null,
    }),
  ]);

  // Mark linked control as having evidence.
  if (input.controlId) {
    await admin.from("control_evidence").insert({
      tenant_id: input.tenantId,
      control_id: input.controlId,
      evidence_id: evidence.id,
      linked_by: actor.userId,
    });
    await admin
      .from("controls")
      .update({ evidence_uploaded: true })
      .eq("id", input.controlId)
      .eq("tenant_id", input.tenantId);
  }

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: "evidence.uploaded",
    entityType: "evidence",
    entityId: evidence.id,
    newValue: {
      fileName: input.file.name,
      classification: input.classification,
      hash: hash.slice(0, 16),
    },
    ipAddress: input.ipAddress ?? null,
  });

  return evidence;
}

/**
 * Generates a short-lived signed URL for evidence download. Restricted
 * classifications require the extra permission; every download is logged.
 */
export async function getEvidenceDownloadUrl(
  actor: ActorContext,
  input: { tenantId: string; evidenceId: string; reason?: string; ipAddress?: string | null },
) {
  const admin = await getTenantDataPlaneClient(input.tenantId);

  // Support-only actors must hold include_evidence on their active grant.
  await assertSupportAccessAllows(actor, input.tenantId, "evidence_download", {
    type: "evidence",
    id: input.evidenceId,
  });

  const { data: evidence } = await admin
    .from("evidence")
    .select("*")
    .eq("id", input.evidenceId)
    .eq("tenant_id", input.tenantId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!evidence) throw new Error("Evidence not found");

  if (!hasPermission(actor, input.tenantId, "evidence.download")) {
    throw new Error("evidence.download permission required");
  }
  if (
    RESTRICTED_CLASSIFICATIONS.includes(evidence.classification) &&
    !hasPermission(actor, input.tenantId, "evidence.restricted.read")
  ) {
    throw new Error("Restricted evidence requires additional permission");
  }
  if (
    RESTRICTED_CLASSIFICATIONS.includes(evidence.classification) &&
    !input.reason
  ) {
    throw new Error("Downloading restricted evidence requires a documented reason");
  }

  const { data: signed, error } = await admin.storage
    .from("evidence")
    .createSignedUrl(evidence.storage_path, 300);
  if (error || !signed) throw new Error("Could not create signed URL");

  await Promise.all([
    admin.from("evidence_access_logs").insert({
      tenant_id: input.tenantId,
      evidence_id: evidence.id,
      action: "downloaded",
      actor_user_id: actor.userId,
      ip_address: input.ipAddress ?? null,
      reason: input.reason ?? null,
    }),
    admin.from("download_logs").insert({
      tenant_id: input.tenantId,
      actor_user_id: actor.userId,
      resource_type: "evidence",
      resource_id: evidence.id,
      file_name: evidence.file_name,
      ip_address: input.ipAddress ?? null,
    }),
    admin.from("evidence_chain_of_custody").insert({
      tenant_id: input.tenantId,
      evidence_id: evidence.id,
      event: "downloaded",
      detail: input.reason ?? null,
      actor_user_id: actor.userId,
    }),
  ]);

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: "evidence.downloaded",
    entityType: "evidence",
    entityId: evidence.id,
    reason: input.reason ?? null,
    ipAddress: input.ipAddress ?? null,
  });

  return { url: signed.signedUrl, fileName: evidence.file_name };
}
