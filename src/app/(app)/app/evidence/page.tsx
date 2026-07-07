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
import { getAdminClient } from "@/lib/server/supabase-admin";

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

  const admin = getAdminClient();
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
              <TableHead>Legal hold</TableHead>
              <TableHead>Uppladdad</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(evidence ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground">
                  Inga bevis uppladdade ännu.
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
                  <TableCell>{e.legal_hold ? <StatusBadge color="red">Ja</StatusBadge> : "Nej"}</TableCell>
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
