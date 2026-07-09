import { NextResponse, type NextRequest } from "next/server";

import { getActorContext, isPlatformAdmin } from "@/lib/authz/context";
import { assertDataPlaneReady } from "@/lib/server/data-plane";
import { env, optionalEnv } from "@/lib/server/env";
import { isEmailConfigured } from "@/lib/server/email";
import { isAuthorizedJobRequest } from "@/lib/server/job-auth";
import { log } from "@/lib/server/log";
import { getAdminClient } from "@/lib/server/supabase-admin";

type CheckStatus = "ok" | "degraded" | "failed" | "not_configured";

interface Check {
  status: CheckStatus;
  detail?: string;
}

/**
 * Operational readiness endpoint (batch 17). NOT public — requires a platform
 * admin session or the job secret (for external monitoring).
 *
 * Checks: DB connectivity, storage bucket access, migration marker, job
 * secret, email provider, rule package freshness, Model B/C data-plane
 * readiness.
 */
export async function GET(req: NextRequest) {
  const authorizedByJobSecret = isAuthorizedJobRequest(req);
  if (!authorizedByJobSecret) {
    const actor = await getActorContext().catch(() => null);
    if (!actor || !isPlatformAdmin(actor)) {
      return NextResponse.json(
        { error: { code: "unauthorized", message: "Authentication required" } },
        { status: 401 },
      );
    }
  }

  const checks: Record<string, Check> = {};
  const admin = getAdminClient();

  // Database connectivity + rule package freshness.
  try {
    const { data, error } = await admin
      .from("regulatory_rule_sets")
      .select("code, version, last_verified_at")
      .order("last_verified_at", { ascending: false, nullsFirst: false })
      .limit(1);
    if (error) throw new Error(error.message);
    const newest = data?.[0];
    checks.database = { status: "ok" };
    if (newest?.last_verified_at) {
      const ageDays = Math.floor(
        (Date.now() - new Date(newest.last_verified_at).getTime()) / 86_400_000,
      );
      checks.rulePackages = {
        status: ageDays > 180 ? "degraded" : "ok",
        detail: `senast verifierad för ${ageDays} dagar sedan`,
      };
    } else {
      checks.rulePackages = {
        status: "degraded",
        detail: "ingen verifieringsstämpel",
      };
    }
  } catch (err) {
    checks.database = {
      status: "failed",
      detail: err instanceof Error ? err.message : "unknown",
    };
    checks.rulePackages = { status: "failed" };
  }

  // Migration marker: probes a column added by the latest migration series.
  try {
    const { error } = await admin
      .from("incident_report_submissions")
      .select("reference")
      .limit(1);
    checks.migrations = error
      ? { status: "failed", detail: "migration 0022+ saknas" }
      : { status: "ok" };
  } catch {
    checks.migrations = { status: "failed" };
  }

  // Storage bucket access.
  try {
    const { error } = await admin.storage
      .from(env.storageBucket)
      .list("", { limit: 1 });
    checks.storage = error
      ? { status: "failed", detail: error.message }
      : { status: "ok" };
  } catch (err) {
    checks.storage = {
      status: "failed",
      detail: err instanceof Error ? err.message : "unknown",
    };
  }

  // Configuration checks (no secrets leaked — presence only).
  checks.jobSecret = optionalEnv("JOB_RUNNER_SECRET")
    ? { status: "ok" }
    : { status: "not_configured", detail: "jobb körs inte utan JOB_RUNNER_SECRET" };
  checks.emailProvider = isEmailConfigured()
    ? { status: "ok" }
    : { status: "not_configured", detail: "inbjudningar/notifieringar via e-post inaktiva" };
  checks.webhookSigning = optionalEnv("WEBHOOK_SIGNING_SECRET")
    ? { status: "ok" }
    : { status: "not_configured" };

  // Data-plane readiness for Model B/C tenants.
  try {
    const { data: bcTenants } = await admin
      .from("tenants")
      .select("id, name, deployment_model")
      .in("deployment_model", ["single_tenant", "customer_owned"])
      .is("deleted_at", null);
    const planes = await Promise.all(
      (bcTenants ?? []).map(async (t) => ({
        tenantId: t.id,
        ...(await assertDataPlaneReady(t.id)),
      })),
    );
    const unready = planes.filter((p) => !p.ready);
    checks.dataPlanes = {
      status: unready.length === 0 ? "ok" : "degraded",
      detail: `${planes.length} isolerade planer, ${unready.length} ej redo (fail closed)`,
    };
  } catch (err) {
    checks.dataPlanes = {
      status: "failed",
      detail: err instanceof Error ? err.message : "unknown",
    };
  }

  const failed = Object.values(checks).some((c) => c.status === "failed");
  const degraded = Object.values(checks).some((c) => c.status === "degraded");
  const overall: CheckStatus = failed ? "failed" : degraded ? "degraded" : "ok";

  if (overall !== "ok") {
    log.warn("readiness_not_ok", { overall });
  }

  return NextResponse.json(
    {
      status: overall,
      version: process.env.npm_package_version ?? "unknown",
      time: new Date().toISOString(),
      checks,
    },
    { status: failed ? 503 : 200 },
  );
}
