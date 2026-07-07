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
import { coverageColor, ruleStatusColor } from "@/components/app/status-colors";
import { requirePlatformRole } from "@/lib/services/require-platform";
import { getAdminClient } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rule packages" };

export default async function RulePackagesPage() {
  await requirePlatformRole();
  const admin = getAdminClient();

  const { data: ruleSets } = await admin
    .from("regulatory_rule_sets")
    .select("*, legal_sources(name_sv, official_number)")
    .order("code");

  return (
    <main className="p-8">
      <PageHeader
        title="Rule packages"
        description="Versioned legal rule packages. Rules that are not final are marked draft, pending or manual review — never guessed."
      />

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Coverage</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Effective from</TableHead>
              <TableHead>Manual review</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(ruleSets ?? []).map((rs) => (
              <TableRow key={rs.id}>
                <TableCell>
                  <Link
                    href={`/platform/rules/${rs.code}`}
                    className="font-mono text-sm font-medium text-primary hover:underline"
                  >
                    {rs.code}
                  </Link>
                </TableCell>
                <TableCell className="max-w-md">{rs.name}</TableCell>
                <TableCell>
                  <StatusBadge color={ruleStatusColor(rs.status)}>{rs.status}</StatusBadge>
                </TableCell>
                <TableCell>
                  <StatusBadge color={coverageColor(rs.coverage_status)}>
                    {rs.coverage_status}
                  </StatusBadge>
                </TableCell>
                <TableCell className="font-mono text-sm">{rs.version}</TableCell>
                <TableCell>{rs.effective_from ?? "–"}</TableCell>
                <TableCell>
                  {rs.manual_review_required ? (
                    <StatusBadge color="purple">Ja</StatusBadge>
                  ) : (
                    "–"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
