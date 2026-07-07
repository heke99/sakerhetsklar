import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import JSZip from "jszip";

import { getAdminClient } from "@/lib/server/supabase-admin";

const DOC_FILES: { zipPath: string; repoPath: string }[] = [
  { zipPath: "sakerhetsbilaga.md", repoPath: "docs/procurement/security-appendix.md" },
  { zipPath: "pub-dpa-bilaga.md", repoPath: "docs/procurement/dpa-pub-appendix.md" },
  { zipPath: "underbitraden.md", repoPath: "docs/procurement/subprocessors.md" },
  { zipPath: "dataresidens.md", repoPath: "docs/procurement/data-residency.md" },
  { zipPath: "tredjelandsoverforing.md", repoPath: "docs/procurement/third-country-transfer.md" },
  { zipPath: "kryptering-nyckelhantering.md", repoPath: "docs/security/encryption-key-management.md" },
  { zipPath: "supportatkomst.md", repoPath: "docs/security/support-access.md" },
  { zipPath: "break-glass.md", repoPath: "docs/security/break-glass.md" },
  { zipPath: "anomalidetektering.md", repoPath: "docs/security/anomaly-detection.md" },
  { zipPath: "driftmodell-b-single-tenant.md", repoPath: "docs/deployment/model-b-single-tenant.md" },
  { zipPath: "driftmodell-c-kundagd.md", repoPath: "docs/deployment/model-c-customer-owned-data-plane.md" },
  { zipPath: "exit-export-radering.md", repoPath: "docs/exit-plan/export-and-deletion.md" },
  { zipPath: "retentionpolicy.md", repoPath: "docs/gdpr/retention-policy.md" },
  { zipPath: "tillganglighetsredogorelse-mall.md", repoPath: "docs/accessibility/accessibility-statement-template.md" },
  { zipPath: "runbook-plattformsincidenter.md", repoPath: "docs/runbooks/platform-incident-response.md" },
  { zipPath: "runbook-backup-restore.md", repoPath: "docs/runbooks/backup-restore.md" },
];

const MODEL_LABELS: Record<string, string> = {
  multi_tenant: "Model A — delad SaaS med RLS-tenantisolering",
  single_tenant: "Model B — single-tenant, leverantörsdriftad isolerad datamiljö",
  customer_owned: "Model C — kundägd datamiljö",
};

/**
 * Procurement/security package (spec §40): standardized documents plus a
 * tenant-specific responsibility matrix and register extracts.
 */
export async function buildProcurementPackage(tenantId: string): Promise<{
  buffer: Buffer;
  fileName: string;
  manifest: Record<string, number | string>;
}> {
  const admin = getAdminClient();
  const zip = new JSZip();

  const [tenantRes, vendorsRes, processingRes] = await Promise.all([
    admin
      .from("tenants")
      .select("name, organization_number, deployment_model, plan")
      .eq("id", tenantId)
      .maybeSingle(),
    admin
      .from("vendors")
      .select("name, organization_number, services_description, data_residency, personal_data_processor, dpa_exists")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null),
    admin
      .from("outsourced_processing_records")
      .select("*")
      .eq("tenant_id", tenantId),
  ]);

  const tenant = tenantRes.data;
  const model = tenant?.deployment_model ?? "multi_tenant";

  // Static documentation from the repository.
  for (const doc of DOC_FILES) {
    try {
      const content = await readFile(join(process.cwd(), doc.repoPath), "utf8");
      zip.file(doc.zipPath, content);
    } catch {
      zip.file(doc.zipPath, `Dokumentet ${doc.repoPath} saknas i denna build.\n`);
    }
  }

  // Tenant-specific responsibility matrix.
  const matrix = [
    `# Ansvarsmatris — ${tenant?.name ?? "Tenant"}`,
    "",
    `Driftmodell: **${MODEL_LABELS[model] ?? model}**`,
    "",
    "| Område | Kund | Leverantör |",
    "| --- | --- | --- |",
    model === "customer_owned"
      ? "| Datamiljö (DB/lagring/nycklar/backup) | Äger och driftar | Migrationer + runbooks |"
      : "| Datamiljö (DB/lagring) | Använder | Äger drift, backup och patchning |",
    "| Användare, roller och behörigheter | Administrerar | Plattformsfunktioner |",
    "| Omfattningsbedömning och rapporteringsbeslut | Beslutar (juridiskt ansvar) | Beslutsstöd via regelmotor |",
    "| Incidentrapportering till myndighet | Skickar och ansvarar | Rapportutkast, kopieringsläge, deadlines |",
    "| Bevis och klassificering | Äger innehållet | Hash, åtkomstlogg, spårbarhetskedja |",
    "| Supportåtkomst | Godkänner per tillfälle | Begär, tidsbegränsas, loggas |",
    "| Exit och radering | Beställer | Exportpaket + raderingsintyg |",
    "",
    "Säkerhetsklar tillhandahåller beslutsstöd. Det slutliga juridiska och regulatoriska ansvaret ligger kvar hos organisationen.",
  ].join("\n");
  zip.file("ansvarsmatris.md", matrix);

  // Tenant-specific subprocessor/vendor annex.
  const vendorLines = (vendorsRes.data ?? []).map(
    (v) =>
      `| ${v.name} | ${v.organization_number ?? "–"} | ${v.services_description ?? "–"} | ${v.data_residency ?? "–"} | ${v.personal_data_processor ? "Ja" : "Nej"} | ${v.dpa_exists ? "Ja" : "Nej"} |`,
  );
  zip.file(
    "leverantorsbilaga.md",
    [
      `# Leverantörer och personuppgiftsbiträden — ${tenant?.name ?? ""}`,
      "",
      "| Leverantör | Org.nr | Tjänster | Dataresidens | PUB | DPA |",
      "| --- | --- | --- | --- | --- | --- |",
      ...(vendorLines.length > 0 ? vendorLines : ["| (Inga leverantörer registrerade) | | | | | |"]),
      "",
      `Utkontrakterad behandling: ${(processingRes.data ?? []).length} registrerade poster.`,
    ].join("\n"),
  );

  const manifest = {
    package: "procurement-security-package",
    tenant: tenant?.name ?? tenantId,
    deploymentModel: model,
    documents: DOC_FILES.length + 2,
    vendors: (vendorsRes.data ?? []).length,
    generatedAt: new Date().toISOString(),
  };
  zip.file("MANIFEST.json", JSON.stringify(manifest, null, 2));

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return {
    buffer: Buffer.from(buffer),
    fileName: "upphandlingspaket.zip",
    manifest: manifest as unknown as Record<string, number | string>,
  };
}
