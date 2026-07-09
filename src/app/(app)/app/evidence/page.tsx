import { redirect } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { StatusBadge, type StatusColor } from "@/components/app/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { hasPermission } from "@/lib/authz/context";
import { getCurrentTenant } from "@/lib/services/current-tenant";
import {
  getTenantControlPlaneClient,
  getTenantDataPlaneClient,
} from "@/lib/server/data-plane";

import { EvidenceUploadForm, EvidenceDownloadButton } from "./evidence-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bevisbank" };

const classificationColors: Record<string, StatusColor> = {
  open: "green",
  internal: "blue",
  confidential: "yellow",
  strictly_confidential: "red",
  security_sensitive: "red",
  potentially_security_classified: "purple",
};

export default async function EvidencePage() {
  const current = await getCurrentTenant();
  if (!current) redirect("/login");
  const { tenant, actor } = current;

  const admin = await getTenantDataPlaneClient(tenant.id);
  let query = admin
    .from("evidence")
    .select("*, incidents(reference)")
    .eq("tenant_id", tenant.id)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false });
  if (!hasPermission(actor, tenant.id, "evidence.restricted.read")) {
    query = query.in("classification", ["open", "internal", "confidential"]);
  }
  const { data: evidence } = await query;

  // Uploader names come from the identity control plane.
  const uploaderIds = [
    ...new Set((evidence ?? []).map((e) => e.uploaded_by).filter(Boolean)),
  ] as string[];
  const control = getTenantControlPlaneClient();
  const { data: profiles } = uploaderIds.length
    ? await control
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", uploaderIds)
    : { data: [] as { user_id: string; full_name: string | null; email: string | null }[] };
  const uploaderById = new Map(
    (profiles ?? []).map((p) => [p.user_id, p.full_name ?? p.email ?? p.user_id]),
  );

  return (
    <main className="p-8">
      <PageHeader
        title="Bevisbank"
        description="Bevis med SHA-256-hash, versionshistorik, åtkomstlogg och spårbarhetskedja. Nedladdningar loggas alltid."
      />

      <p className="mb-6 rounded-lg border border-purple-300 bg-purple-50 px-4 py-3 text-sm text-purple-900 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-200">
        Ladda inte upp säkerhetsskyddsklassificerade uppgifter om inte er
        deployment och hanteringsprocess är godkänd för den typen av information.
      </p>

      <div className="mb-8 rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fil</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Klassificering</TableHead>
              <TableHead>Incident</TableHead>
              <TableHead>SHA-256</TableHead>
              <TableHead>Bevarande</TableHead>
              <TableHead>Legal hold</TableHead>
              <TableHead>Uppladdad av</TableHead>
              <TableHead>Uppladdad</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(evidence ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-muted-foreground">
                  Inga bevis uppladdade ännu. Ladda upp den första filen nedan —
                  hash, åtkomstlogg och spårbarhetskedja skapas automatiskt.
                </TableCell>
              </TableRow>
            ) : (
              (evidence ?? []).map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="max-w-52 truncate font-medium">{e.file_name}</TableCell>
                  <TableCell>{e.evidence_type}</TableCell>
                  <TableCell>
                    <StatusBadge color={classificationColors[e.classification] ?? "gray"}>
                      {e.classification}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    {(e.incidents as unknown as { reference: string } | null)?.reference ?? "–"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {String(e.hash_sha256).slice(0, 12)}…
                  </TableCell>
                  <TableCell>
                    {e.retention_until
                      ? new Date(e.retention_until).toLocaleDateString("sv-SE")
                      : "Tillsvidare"}
                  </TableCell>
                  <TableCell>{e.legal_hold ? <StatusBadge color="red">Ja</StatusBadge> : "Nej"}</TableCell>
                  <TableCell className="max-w-40 truncate">
                    {e.uploaded_by ? uploaderById.get(e.uploaded_by) ?? "–" : "–"}
                  </TableCell>
                  <TableCell>{new Date(e.uploaded_at).toLocaleString("sv-SE")}</TableCell>
                  <TableCell>
                    <EvidenceDownloadButton
                      tenantId={tenant.id}
                      evidenceId={e.id}
                      restricted={[
                        "strictly_confidential",
                        "security_sensitive",
                        "potentially_security_classified",
                      ].includes(e.classification)}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <EvidenceUploadForm tenantId={tenant.id} />
    </main>
  );
}
