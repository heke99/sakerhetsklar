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
export const metadata = { title: "Billing" };

export default async function PlatformBillingPage() {
  await requirePlatformRole(["platform_owner", "platform_admin", "billing_admin"]);
  const admin = getAdminClient();

  const [plansRes, subsRes, tenantsRes] = await Promise.all([
    admin.from("billing_plans").select("*, entitlements(*)").order("code"),
    admin.from("subscriptions").select("*, tenants(name)").order("started_at", { ascending: false }),
    admin.from("tenants").select("id, plan").is("deleted_at", null),
  ]);

  const planCounts = new Map<string, number>();
  for (const t of tenantsRes.data ?? []) {
    planCounts.set(t.plan, (planCounts.get(t.plan) ?? 0) + 1);
  }

  return (
    <main className="p-8">
      <PageHeader
        title="Billing and entitlements"
        description="Plan catalog, entitlements and subscriptions. Payment provider is not connected in MVP — the entitlement model is active."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {(plansRes.data ?? []).map((p) => (
          <div key={p.id} className="rounded-xl border bg-card p-5">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-lg font-semibold capitalize">{p.name}</p>
              <StatusBadge color="blue">{planCounts.get(p.code) ?? 0} tenants</StatusBadge>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">{p.description}</p>
            <ul className="space-y-0.5 text-xs text-muted-foreground">
              {((p.entitlements as { entitlement_key: string; limit_value: number | null; enabled: boolean }[]) ?? []).map(
                (e) => (
                  <li key={e.entitlement_key} className="font-mono">
                    {e.entitlement_key}:{" "}
                    {!e.enabled ? "off" : e.limit_value === null ? "unlimited" : e.limit_value}
                  </li>
                ),
              )}
            </ul>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Subscriptions</h2>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(subsRes.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No subscriptions recorded. Tenant plans are set on the tenant record.
                  </TableCell>
                </TableRow>
              ) : (
                (subsRes.data ?? []).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      {(s.tenants as unknown as { name: string } | null)?.name ?? "–"}
                    </TableCell>
                    <TableCell className="capitalize">{s.plan_code}</TableCell>
                    <TableCell>
                      <StatusBadge color={s.status === "active" ? "green" : "yellow"}>
                        {s.status}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>{new Date(s.started_at).toLocaleDateString("sv-SE")}</TableCell>
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
