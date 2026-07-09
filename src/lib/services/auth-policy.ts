import "server-only";

import { getActorContext } from "@/lib/authz/context";
import { hasTenantRole } from "@/lib/authz/context";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { getServerClient } from "@/lib/server/supabase-server";

const SSO_PROVIDER_TYPES = ["entra_id_oidc", "saml", "oidc_generic"];

export interface TenantAuthPolicy {
  providerType: string;
  ssoRequired: boolean;
  mfaRequired: boolean;
}

/** Reads the tenant's active auth provider configuration. */
export async function getTenantAuthPolicy(
  tenantId: string,
): Promise<TenantAuthPolicy> {
  const admin = getAdminClient();
  const { data } = await admin
    .from("tenant_auth_providers")
    .select("provider_type, status, mfa_required")
    .eq("tenant_id", tenantId)
    .eq("status", "active");

  const providers = data ?? [];
  const sso = providers.find((p) => SSO_PROVIDER_TYPES.includes(p.provider_type));
  const mfaRequired = providers.some((p) => p.mfa_required);

  return {
    providerType: sso?.provider_type ?? providers[0]?.provider_type ?? "email_password",
    ssoRequired: Boolean(sso),
    mfaRequired,
  };
}

export type AuthGateResult =
  | { blocked: false }
  | { blocked: true; reason: "sso_required" | "mfa_required" };

/**
 * Fail-closed enforcement of tenant auth requirements, evaluated on every
 * authenticated tenant page load:
 *
 * - Tenant requires SSO: password sessions are blocked for all users except
 *   tenant admins (who need access to fix/complete the SSO configuration).
 *   SSO sign-in is not yet offered by the product, so a required-SSO tenant
 *   is locked rather than silently allowed to bypass its own policy.
 * - Tenant requires MFA: sessions below AAL2 are blocked until the user has
 *   enrolled a second factor.
 */
export async function checkAuthGate(tenantId: string): Promise<AuthGateResult> {
  const [policy, actor] = await Promise.all([
    getTenantAuthPolicy(tenantId),
    getActorContext(),
  ]);
  if (!actor) return { blocked: false }; // unauthenticated → handled by proxy/login

  if (policy.ssoRequired && !hasTenantRole(actor, tenantId, ["tenant_admin"])) {
    return { blocked: true, reason: "sso_required" };
  }

  if (policy.mfaRequired) {
    const supabase = await getServerClient();
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data?.currentLevel !== "aal2") {
      return { blocked: true, reason: "mfa_required" };
    }
  }

  return { blocked: false };
}
