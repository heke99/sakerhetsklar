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
export const metadata = { title: "Feature flags" };

export default async function FeatureFlagsPage() {
  await requirePlatformRole();
  const admin = getAdminClient();

  const [flagsRes, overridesRes] = await Promise.all([
    admin.from("feature_flags").select("*").order("flag_code"),
    admin
      .from("tenant_feature_flags")
      .select("*, tenants(name)")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return (
    <main className="p-8">
      <PageHeader
        title="Feature flags"
        description="Platform-wide defaults and per-tenant overrides."
      />

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Flags</h2>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Flag</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Default</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(flagsRes.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    No feature flags defined.
                  </TableCell>
                </TableRow>
              ) : (
                (flagsRes.data ?? []).map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-mono text-sm">{f.flag_code}</TableCell>
                    <TableCell>{f.description ?? "–"}</TableCell>
                    <TableCell>
                      <StatusBadge color={f.default_enabled ? "green" : "gray"}>
                        {f.default_enabled ? "on" : "off"}
                      </StatusBadge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Tenant overrides</h2>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Flag</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(overridesRes.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No tenant overrides.
                  </TableCell>
                </TableRow>
              ) : (
                (overridesRes.data ?? []).map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>{(o.tenants as { name: string } | null)?.name ?? "–"}</TableCell>
                    <TableCell className="font-mono text-sm">{o.flag_code}</TableCell>
                    <TableCell>
                      <StatusBadge color={o.enabled ? "green" : "gray"}>
                        {o.enabled ? "on" : "off"}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>{o.reason ?? "–"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </main>
  );
}
