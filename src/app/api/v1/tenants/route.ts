import { z } from "zod";

import { withApi, ok, parseBody, forbidden } from "@/lib/api/handler";
import { hasPlatformRole, isPlatformAdmin } from "@/lib/authz/context";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { createTenant } from "@/lib/services/tenants";

export const GET = withApi(async (_req, { actor }) => {
  const admin = getAdminClient();

  if (isPlatformAdmin(actor)) {
    const { data, error } = await admin
      .from("tenants")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ok(data);
  }

  const tenantIds = [...actor.tenantRoles.keys()];
  if (tenantIds.length === 0) return ok([]);

  const { data, error } = await admin
    .from("tenants")
    .select("*")
    .in("id", tenantIds)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  return ok(data);
});

const createSchema = z.object({
  name: z.string().min(1).max(200),
  organizationNumber: z.string().max(20).optional(),
  slug: z
    .string()
    .min(2)
    .max(63)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "Slug must be lowercase alphanumeric with dashes"),
  organizationType: z
    .enum([
      "private_company",
      "municipality",
      "region",
      "municipal_company",
      "state_agency",
      "other_public_body",
      "non_profit",
      "other",
    ])
    .optional(),
  deploymentModel: z
    .enum(["multi_tenant", "single_tenant", "customer_owned"])
    .optional(),
  plan: z.enum(["starter", "business", "enterprise"]).optional(),
  primaryContactName: z.string().max(200).optional(),
  primaryContactEmail: z.string().email().optional(),
});

export const POST = withApi(async (req, { actor }) => {
  if (!hasPlatformRole(actor, ["platform_owner", "platform_admin"])) {
    throw forbidden("Only platform admins can create tenants");
  }
  const input = await parseBody(req, createSchema);
  const tenant = await createTenant(actor, input);
  return ok(tenant, { status: 201 });
});
