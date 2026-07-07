import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { coverageColor, ruleStatusColor } from "@/components/app/status-colors";
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
import { getImpactedTenants } from "@/lib/rule-engine/service";

import { PublishForm } from "./publish-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rule package" };

export default async function RuleSetDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const actor = await requirePlatformRole();
  const { code } = await params;
  const admin = getAdminClient();

  const { data: ruleSet } = await admin
    .from("regulatory_rule_sets")
    .select("*, legal_sources(name_sv, official_number, url, effective_date)")
    .eq("code", code)
    .maybeSingle();
  if (!ruleSet) notFound();

  const [rulesRes, coverageRes, versionsRes, impacted] = await Promise.all([
    admin
      .from("regulatory_rules")
      .select("*")
      .eq("rule_set_id", ruleSet.id)
      .order("sort_order"),
    admin.from("rule_coverage_statuses").select("*").eq("rule_set_id", ruleSet.id),
    admin
      .from("regulatory_rule_versions")
      .select("*")
      .eq("rule_set_id", ruleSet.id)
      .order("published_at", { ascending: false }),
    getImpactedTenants(code),
  ]);

  const canPublish =
    actor.platformRoles.includes("platform_owner") ||
    actor.platformRoles.includes("rule_admin");

  const source = ruleSet.legal_sources as unknown as {
    name_sv: string;
    official_number: string | null;
    url: string | null;
  } | null;

  return (
    <main className="p-8">
      <PageHeader
        title={ruleSet.name}
        description={ruleSet.description_sv ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge color={ruleStatusColor(ruleSet.status)}>{ruleSet.status}</StatusBadge>
            <StatusBadge color={coverageColor(ruleSet.coverage_status)}>
              {ruleSet.coverage_status}
            </StatusBadge>
          </div>
        }
      />

      {ruleSet.manual_review_required ? (
        <p className="mb-6 rounded-lg border border-purple-300 bg-purple-50 px-4 py-3 text-sm text-purple-900 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-200">
          Detta regelpaket kräver manuell bedömning
          {ruleSet.requires_update_when_final
            ? " och ska uppdateras när slutliga regler publiceras."
            : "."}
        </p>
      ) : null}

      <section className="mb-8 rounded-xl border bg-card p-5">
        <h2 className="mb-3 text-lg font-semibold">Legal source</h2>
        <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Source</dt>
            <dd className="font-medium">{source?.name_sv ?? "–"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Official number</dt>
            <dd className="font-medium">{source?.official_number ?? "–"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Effective from</dt>
            <dd className="font-medium">{ruleSet.effective_from ?? "–"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Current version</dt>
            <dd className="font-mono font-medium">{ruleSet.version}</dd>
          </div>
        </dl>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Rules ({(rulesRes.data ?? []).length})</h2>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Sectors</TableHead>
                <TableHead>Legal reference</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Coverage</TableHead>
                <TableHead>Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rulesRes.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    No rules defined yet in this package.
                  </TableCell>
                </TableRow>
              ) : (
                (rulesRes.data ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <p className="font-medium">{r.title_sv}</p>
                      <p className="font-mono text-xs text-muted-foreground">{r.rule_code}</p>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.rule_type}</TableCell>
                    <TableCell className="max-w-40 text-xs">
                      {(r.applicable_sectors ?? []).length === 0
                        ? "alla"
                        : (r.applicable_sectors ?? []).join(", ")}
                    </TableCell>
                    <TableCell className="text-xs">{r.legal_reference ?? "–"}</TableCell>
                    <TableCell>
                      <StatusBadge color={ruleStatusColor(r.status)}>{r.status}</StatusBadge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge color={coverageColor(r.coverage_status)}>
                        {r.coverage_status}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>{r.confidence}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {(coverageRes.data ?? []).length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Sector coverage</h2>
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sector</TableHead>
                  <TableHead>Coverage</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(coverageRes.data ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-sm">{c.sector_code ?? "all"}</TableCell>
                    <TableCell>
                      <StatusBadge color={coverageColor(c.coverage_status)}>
                        {c.coverage_status}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-sm">{c.note_sv ?? "–"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ) : null}

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">
          Impacted tenants ({impacted.length})
        </h2>
        <div className="rounded-xl border bg-card p-4 text-sm">
          {impacted.length === 0 ? (
            <p className="text-muted-foreground">
              No tenants currently have this rule package assigned.
            </p>
          ) : (
            <ul className="grid gap-1 sm:grid-cols-2">
              {impacted.map((t) => (
                <li key={t.tenantId}>
                  {t.name}{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    v{t.currentVersion}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {canPublish ? (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Publish new version</h2>
          <PublishForm code={code} currentVersion={ruleSet.version} impactedCount={impacted.length} />
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Version history</h2>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Changelog</TableHead>
                <TableHead>Published</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(versionsRes.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No published versions yet.
                  </TableCell>
                </TableRow>
              ) : (
                (versionsRes.data ?? []).map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono">{v.version}</TableCell>
                    <TableCell>
                      <StatusBadge color={v.status === "published" ? "green" : "gray"}>
                        {v.status}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="max-w-md truncate">{v.changelog ?? "–"}</TableCell>
                    <TableCell>{new Date(v.published_at).toLocaleString("sv-SE")}</TableCell>
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
