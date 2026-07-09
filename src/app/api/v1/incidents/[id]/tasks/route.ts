import { z } from "zod";

import { withApi, ok, parseBody, forbidden, notFound } from "@/lib/api/handler";
import { hasPermission } from "@/lib/authz/context";
import { assertIncidentTenant } from "@/lib/authz/tenant-guards";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { writeAuditLog } from "@/lib/audit/log";

const taskSchema = z.object({
  tenantId: z.string().uuid(),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  assignedToName: z.string().max(200).optional(),
  dueAt: z.string().datetime({ offset: true }).optional(),
  taskType: z.string().max(100).optional(),
});

export const POST = withApi<{ id: string }>(async (req, { actor, params }) => {
  const input = await parseBody(req, taskSchema);
  if (!hasPermission(actor, input.tenantId, "incidents.write")) {
    throw forbidden("incidents.write permission required");
  }
  await assertIncidentTenant(actor, params.id, input.tenantId);

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("incident_tasks")
    .insert({
      tenant_id: input.tenantId,
      incident_id: params.id,
      title: input.title,
      description: input.description ?? null,
      assigned_to_name: input.assignedToName ?? null,
      due_at: input.dueAt ?? null,
      task_type: input.taskType ?? null,
      created_by: actor.userId,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: "incident.task_created",
    entityType: "incident_task",
    entityId: data.id,
    newValue: { title: input.title, incidentId: params.id },
  });

  return ok(data, { status: 201 });
});

const patchSchema = z.object({
  tenantId: z.string().uuid(),
  taskId: z.string().uuid(),
  status: z.enum(["open", "in_progress", "done", "cancelled"]),
});

export const PATCH = withApi<{ id: string }>(async (req, { actor, params }) => {
  const input = await parseBody(req, patchSchema);
  if (!hasPermission(actor, input.tenantId, "incidents.write")) {
    throw forbidden();
  }
  await assertIncidentTenant(actor, params.id, input.tenantId);

  const admin = getAdminClient();
  // Scope the update to the incident in the URL as well as the tenant so a
  // task id from another incident cannot be manipulated through this route.
  const { data, error } = await admin
    .from("incident_tasks")
    .update({ status: input.status })
    .eq("id", input.taskId)
    .eq("tenant_id", input.tenantId)
    .eq("incident_id", params.id)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw notFound("Resource not found");
  return ok(data);
});
