import Link from "next/link";

import { PageHeader } from "@/components/app/page-header";
import { requirePlatformRole } from "@/lib/services/require-platform";
import { getPlatformStats } from "@/lib/services/platform-stats";

export const dynamic = "force-dynamic";
export const metadata = { title: "Platform dashboard" };

function StatCard({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number | string;
  href?: string;
  tone?: "warn" | "critical";
}) {
  const body = (
    <div className="rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/40">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={
          tone === "critical"
            ? "mt-2 text-2xl font-bold text-red-600"
            : tone === "warn"
              ? "mt-2 text-2xl font-bold text-amber-600"
              : "mt-2 text-2xl font-bold"
        }
      >
        {value}
      </p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function PlatformDashboardPage() {
  await requirePlatformRole();
  const stats = await getPlatformStats();

  return (
    <main className="p-8">
      <PageHeader
        title="Platform dashboard"
        description="Tenants, onboarding, rule coverage, incidents, support access and operational health."
      />

      <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        Tenants
      </h2>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total tenants" value={stats.totalTenants} href="/platform/tenants" />
        <StatCard label="Active tenants" value={stats.activeTenants} href="/platform/tenants" />
        <StatCard label="Trial (starter)" value={stats.trialTenants} />
        <StatCard label="Enterprise" value={stats.enterpriseTenants} />
        <StatCard label="Multi-tenant SaaS (A)" value={stats.multiTenantCount} />
        <StatCard label="Single-tenant (B)" value={stats.singleTenantCount} />
        <StatCard label="Customer-owned data plane (C)" value={stats.customerOwnedCount} />
        <StatCard label="Paused tenants" value={stats.pausedTenants} tone={stats.pausedTenants > 0 ? "warn" : undefined} />
      </div>

      <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        Onboarding and rule coverage
      </h2>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Onboarding not started" value={stats.onboardingNotStarted} />
        <StatCard label="Onboarding in progress" value={stats.onboardingInProgress} />
        <StatCard
          label="Onboarding blocked"
          value={stats.onboardingBlocked}
          tone={stats.onboardingBlocked > 0 ? "warn" : undefined}
        />
        <StatCard
          label="Missing rule profile"
          value={stats.tenantsMissingRuleProfile}
          href="/platform/rules"
          tone={stats.tenantsMissingRuleProfile > 0 ? "warn" : undefined}
        />
      </div>

      <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        Incidents and deadlines
      </h2>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tenants with active incidents" value={stats.tenantsWithActiveIncidents} />
        <StatCard
          label="Potential significant incidents"
          value={stats.tenantsWithPotentialSignificant}
          tone={stats.tenantsWithPotentialSignificant > 0 ? "warn" : undefined}
        />
        <StatCard
          label="Missed reporting deadlines"
          value={stats.tenantsWithMissedDeadlines}
          tone={stats.tenantsWithMissedDeadlines > 0 ? "critical" : undefined}
        />
      </div>

      <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        Support access and operations
      </h2>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Support access active now"
          value={stats.activeSupportAccess}
          href="/platform/support-access"
          tone={stats.activeSupportAccess > 0 ? "warn" : undefined}
        />
        <StatCard
          label="Support access pending"
          value={stats.pendingSupportAccess}
          href="/platform/support-access"
        />
        <StatCard
          label="Rule packages active"
          value={stats.rulePackagesByStatus["active"] ?? 0}
          href="/platform/rules"
        />
        <StatCard
          label="Rule packages pending/draft"
          value={
            (stats.rulePackagesByStatus["pending_guidance"] ?? 0) +
            (stats.rulePackagesByStatus["draft"] ?? 0) +
            (stats.rulePackagesByStatus["manual_review_required"] ?? 0)
          }
          href="/platform/rules"
          tone="warn"
        />
        <StatCard
          label="Unhealthy tenants"
          value={stats.healthByStatus["unhealthy"] ?? 0}
          href="/platform/health"
          tone={(stats.healthByStatus["unhealthy"] ?? 0) > 0 ? "critical" : undefined}
        />
        <StatCard
          label="Production ready tenants"
          value={stats.productionReadinessByStatus["ready"] ?? 0}
          href="/platform/deployments"
        />
      </div>
    </main>
  );
}
