import { z } from "zod";

import { withApi, ok, parseBody, forbidden } from "@/lib/api/handler";
import { hasPermission } from "@/lib/authz/context";
import { getAdminClient } from "@/lib/server/supabase-admin";

const commentSchema = z.object({
  tenantId: z.string().uuid(),
  body: z.string().min(1).max(10000),
});

export const POST = withApi<{ id: string }>(async (req, { actor, params }) => {
  const input = await parseBody(req, commentSchema);
  if (!hasPermission(actor, input.tenantId, "incidents.write")) {
    throw forbidden("incidents.write permission required");
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("incident_comments")
    .insert({
      tenant_id: input.tenantId,
      incident_id: params.id,
      body: input.body,
      created_by: actor.userId,
      created_by_name: actor.email,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await admin.from("incident_events").insert({
    tenant_id: input.tenantId,
    incident_id: params.id,
    event_type: "note",
    title: "Kommentar tillagd",
    detail: input.body.slice(0, 200),
    created_by: actor.userId,
  });

  return ok(data, { status: 201 });
});
