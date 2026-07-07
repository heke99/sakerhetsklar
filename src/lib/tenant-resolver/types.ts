export type DeploymentModel = "multi_tenant" | "single_tenant" | "customer_owned";
export type Environment = "test" | "stage" | "prod";

/** Registry rows the resolver consumes (loaded from the control plane). */
export interface DomainRegistryRow {
  domain: string;
  tenantId: string;
  environment: Environment;
  domainStatus: "active" | "pending_verification" | "disabled";
  tenantStatus: "active" | "paused" | "disabled";
  deploymentModel: DeploymentModel;
  enabledModules: string[];
  authProviderType: string | null;
  dataPlane: {
    status: "active" | "inactive" | "provisioning" | "decommissioned";
    supabaseUrl: string | null;
    publishableKey: string | null;
    apiBaseUrl: string | null;
    environment: Environment;
  } | null;
}

/**
 * Safe, non-secret configuration exposed after resolution. This object may be
 * cached and sent to the frontend. It must never contain service-role keys,
 * secret references or another tenant's data.
 */
export interface ResolvedTenantConfig {
  tenantId: string;
  environment: Environment;
  deploymentModel: DeploymentModel;
  enabledModules: string[];
  authProviderType: string;
  supabaseUrl: string;
  publishableKey: string;
  apiBaseUrl: string;
}

export type ResolutionFailureReason =
  | "unknown_domain"
  | "domain_disabled"
  | "domain_pending_verification"
  | "tenant_paused"
  | "tenant_disabled"
  | "environment_mismatch"
  | "data_plane_inactive"
  | "data_plane_missing"
  | "missing_auth_provider"
  | "invalid_host";

export type ResolutionResult =
  | { ok: true; config: ResolvedTenantConfig }
  | { ok: false; reason: ResolutionFailureReason };
