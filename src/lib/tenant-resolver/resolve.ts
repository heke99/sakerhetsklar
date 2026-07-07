import type {
  DomainRegistryRow,
  ResolutionResult,
  ResolvedTenantConfig,
} from "./types";

/**
 * Normalizes an incoming Host header value. Fails closed on anything that is
 * not a plain, well-formed hostname (spoofing attempts, embedded credentials,
 * paths, non-ASCII tricks).
 */
export function normalizeHost(rawHost: string | null | undefined): string | null {
  if (!rawHost) return null;
  const trimmed = rawHost.trim().toLowerCase();
  if (!trimmed) return null;

  // Reject anything with a scheme, path, query, credentials or whitespace.
  if (/[\s/\\@?#]/.test(trimmed)) return null;

  // Strip a single :port suffix (numeric only).
  const match = /^([a-z0-9.-]+)(:(\d{1,5}))?$/.exec(trimmed);
  if (!match) return null;

  const host = match[1];
  // Reject leading/trailing dots or dashes and empty labels.
  if (
    host.startsWith(".") ||
    host.endsWith(".") ||
    host.split(".").some((label) => label.length === 0 || label.startsWith("-") || label.endsWith("-"))
  ) {
    return null;
  }
  return host;
}

/**
 * Pure resolution: host + registry snapshot → tenant config or fail-closed
 * refusal. Deployment models:
 *  - Model A (multi_tenant): served from the shared data plane (defaults).
 *  - Model B (single_tenant) / Model C (customer_owned): must have an active
 *    data-plane connection; otherwise resolution fails closed.
 */
export function resolveFromRegistry(
  rawHost: string | null | undefined,
  registry: ReadonlyMap<string, DomainRegistryRow>,
  sharedDataPlane: { supabaseUrl: string; publishableKey: string; apiBaseUrl: string },
): ResolutionResult {
  const host = normalizeHost(rawHost);
  if (!host) return { ok: false, reason: "invalid_host" };

  const row = registry.get(host);
  if (!row) return { ok: false, reason: "unknown_domain" };

  if (row.domainStatus === "disabled") return { ok: false, reason: "domain_disabled" };
  if (row.domainStatus === "pending_verification") {
    return { ok: false, reason: "domain_pending_verification" };
  }

  if (row.tenantStatus === "paused") return { ok: false, reason: "tenant_paused" };
  if (row.tenantStatus === "disabled") return { ok: false, reason: "tenant_disabled" };

  const authProviderType = row.authProviderType ?? "email_password";

  if (row.deploymentModel === "multi_tenant") {
    const config: ResolvedTenantConfig = {
      tenantId: row.tenantId,
      environment: row.environment,
      deploymentModel: row.deploymentModel,
      enabledModules: [...row.enabledModules],
      authProviderType,
      supabaseUrl: sharedDataPlane.supabaseUrl,
      publishableKey: sharedDataPlane.publishableKey,
      apiBaseUrl: sharedDataPlane.apiBaseUrl,
    };
    return { ok: true, config };
  }

  // Model B/C require an isolated data plane.
  const plane = row.dataPlane;
  if (!plane) return { ok: false, reason: "data_plane_missing" };
  if (plane.status !== "active") return { ok: false, reason: "data_plane_inactive" };
  if (plane.environment !== row.environment) {
    return { ok: false, reason: "environment_mismatch" };
  }
  if (!plane.supabaseUrl || !plane.publishableKey) {
    return { ok: false, reason: "data_plane_missing" };
  }

  const config: ResolvedTenantConfig = {
    tenantId: row.tenantId,
    environment: row.environment,
    deploymentModel: row.deploymentModel,
    enabledModules: [...row.enabledModules],
    authProviderType,
    supabaseUrl: plane.supabaseUrl,
    publishableKey: plane.publishableKey,
    apiBaseUrl: plane.apiBaseUrl ?? sharedDataPlane.apiBaseUrl,
  };
  return { ok: true, config };
}
