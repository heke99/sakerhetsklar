import "server-only";

import { redirect } from "next/navigation";

import { getActorContext, type ActorContext } from "@/lib/authz/context";
import type { PlatformRole } from "@/lib/authz/roles";

/** Guards /platform pages: requires an active platform role or redirects. */
export async function requirePlatformRole(
  roles?: PlatformRole[],
): Promise<ActorContext> {
  const actor = await getActorContext();
  if (!actor) redirect("/login?next=/platform");
  if (actor.platformRoles.length === 0) redirect("/app/overview");
  if (roles && !actor.platformRoles.some((r) => roles.includes(r))) {
    redirect("/platform");
  }
  return actor;
}
