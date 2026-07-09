import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requirePlatformRole } from "@/lib/services/require-platform";
import { getAdminClient } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Integrations" };

export default async function PlatformIntegrationsPage() {
  await requirePlatformRole();
  const admin = getAdminClient();

  const { data: integrations } = await admin
    .from("integrations")
    .select("*, tenants(name)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <main className="p-8">
      <PageHeader
        title="Integrations"
        description="Integration status across tenants. Secrets are stored as references only — never in the database or client."
      />

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last sync</TableHead>
              <TableHead>Last error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(integrations ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  No integrations configured. Available today: Excel import, PDF/Word
                  export, webhook API, Teams notifications, evidence upload,
                  copy-to-Cyberportalen. Entra ID/OIDC/SAML SSO requires per-tenant
                  provisioning and fails closed until configured.
                </TableCell>
              </TableRow>
            ) : (
              (integrations ?? []).map((i) => (
                <TableRow key={i.id}>
                  <TableCell>
                    {(i.tenants as unknown as { name: string } | null)?.name ?? "–"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{i.integration_type}</TableCell>
                  <TableCell>{i.name}</TableCell>
                  <TableCell>
                    <StatusBadge
                      color={
                        i.status === "active"
                          ? "green"
                          : i.status === "error"
                            ? "red"
                            : "yellow"
                      }
                    >
                      {i.status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    {i.last_sync_at ? new Date(i.last_sync_at).toLocaleString("sv-SE") : "–"}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{i.last_error ?? "–"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
