import Link from "next/link";

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
export const metadata = { title: "Rule versions" };

export default async function RuleVersionsPage() {
  await requirePlatformRole();
  const admin = getAdminClient();

  const { data: versions } = await admin
    .from("regulatory_rule_versions")
    .select("*, regulatory_rule_sets(code, name)")
    .order("published_at", { ascending: false })
    .limit(200);

  return (
    <main className="p-8">
      <PageHeader
        title="Rule versions"
        description="Published rule package versions with full snapshots for traceability."
      />

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rule set</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Changelog</TableHead>
              <TableHead>Published</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(versions ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  No versions published yet.
                </TableCell>
              </TableRow>
            ) : (
              (versions ?? []).map((v) => {
                const rs = v.regulatory_rule_sets as unknown as {
                  code: string;
                  name: string;
                } | null;
                return (
                  <TableRow key={v.id}>
                    <TableCell>
                      {rs ? (
                        <Link
                          href={`/platform/rules/${rs.code}`}
                          className="font-mono text-sm text-primary hover:underline"
                        >
                          {rs.code}
                        </Link>
                      ) : (
                        "–"
                      )}
                    </TableCell>
                    <TableCell className="font-mono">{v.version}</TableCell>
                    <TableCell>
                      <StatusBadge color={v.status === "published" ? "green" : "gray"}>
                        {v.status}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="max-w-md truncate">{v.changelog ?? "–"}</TableCell>
                    <TableCell>{new Date(v.published_at).toLocaleString("sv-SE")}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
