import "server-only";

import { getActorContext, type ActorContext } from "@/lib/authz/context";
import { getAdminClient } from "@/lib/server/supabase-admin";

export interface CurrentTenant {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  plan: string;
  deployment_model: string;
  onboarding_status: string;
  organization_number: string | null;
  organization_type: string | null;
}

/**
 * Resolves the tenant the current user is working in. Most users belong to a
 * single tenant; multi-tenant users get their first active tenant unless a
 * specific tenant is requested (and authorized).
 */
export async function getCurrentTenant(
  requestedTenantId?: string,
): Promise<{ actor: ActorContext; tenant: CurrentTenant } | null> {
  const actor = await getActorContext();
  if (!actor) return null;

  const memberTenantIds = [...actor.tenantRoles.keys()];
  let tenantId: string | undefined;

  if (requestedTenantId) {
    if (
      !memberTenantIds.includes(requestedTenantId) &&
      !actor.supportAccessTenantIds.has(requestedTenantId) &&
      actor.platformRoles.length === 0
    ) {
      return null;
    }
    tenantId = requestedTenantId;
  } else {
    tenantId = memberTenantIds[0];
  }

  if (!tenantId) return null;

  const admin = getAdminClient();
  const { data } = await admin
    .from("tenants")
    .select(
      "id, name, slug, status, plan, deployment_model, onboarding_status, organization_number, organization_type",
    )
    .eq("id", tenantId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data || data.status === "disabled") return null;
  return { actor, tenant: data as CurrentTenant };
}
