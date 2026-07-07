import { withApi, ok } from "@/lib/api/handler";

export const GET = withApi(async (_req, { actor }) => {
  return ok({
    userId: actor.userId,
    email: actor.email,
    platformRoles: actor.platformRoles,
    tenants: [...actor.tenantRoles.entries()].map(([tenantId, roles]) => ({
      tenantId,
      roles,
    })),
  });
});
