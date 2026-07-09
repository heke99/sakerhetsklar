import { z } from "zod";

import { withApi, ok, parseBody, forbidden, notFound } from "@/lib/api/handler";
import { hasPermission, isTenantMember } from "@/lib/authz/context";
import { assertIncidentTenant } from "@/lib/authz/tenant-guards";
import { getTenantDataPlaneClient } from "@/lib/server/data-plane";
import { writeAuditLog } from "@/lib/audit/log";

export const GET = withApi<{ id: string }>(async (req, { actor, params }) => {
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  if (!tenantId) throw notFound("tenantId is required");
  if (!isTenantMember(actor, tenantId)) throw forbidden();

  const admin = await getTenantDataPlaneClient(tenantId);
  const { data, error } = await admin
    .from("incident_war_rooms")
    .select("*, war_room_members(*), war_room_decisions(*), war_room_tasks(*), war_room_messages(*)")
    .eq("incident_id", params.id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return ok(data);
});

const actionSchema = z.object({
  tenantId: z.string().uuid(),
  action: z.enum(["activate", "close", "add_member", "add_decision", "add_task", "add_message"]),
  memberName: z.string().max(200).optional(),
  memberRole: z.string().max(100).optional(),
  isExternal: z.boolean().optional(),
  decision: z.string().max(2000).optional(),
  optionsConsidered: z.string().max(2000).optional(),
  selectedOption: z.string().max(2000).optional(),
  reason: z.string().max(2000).optional(),
  approverName: z.string().max(200).optional(),
  taskTitle: z.string().max(300).optional(),
  taskAssignee: z.string().max(200).optional(),
  message: z.string().max(5000).optional(),
});

export const POST = withApi<{ id: string }>(async (req, { actor, params }) => {
  const input = await parseBody(req, actionSchema);
  if (!hasPermission(actor, input.tenantId, "war_room.access")) {
    throw forbidden("war_room.access permission required");
  }
  await assertIncidentTenant(actor, params.id, input.tenantId);

  const admin = await getTenantDataPlaneClient(input.tenantId);

  if (input.action === "activate") {
    const { data, error } = await admin
      .from("incident_war_rooms")
      .upsert(
        {
          tenant_id: input.tenantId,
          incident_id: params.id,
          status: "active",
          activated_by: actor.userId,
        },
        { onConflict: "incident_id" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);

    await writeAuditLog({
      tenantId: input.tenantId,
      actorUserId: actor.userId,
      action: "war_room.activated",
      entityType: "incident_war_room",
      entityId: data.id,
      newValue: { incidentId: params.id },
    });
    return ok(data, { status: 201 });
  }

  const { data: warRoom } = await admin
    .from("incident_war_rooms")
    .select("id")
    .eq("incident_id", params.id)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (!warRoom) throw notFound("War room not activated");

  switch (input.action) {
    case "close": {
      const { data, error } = await admin
        .from("incident_war_rooms")
        .update({
          status: "closed",
          closed_by: actor.userId,
          closed_at: new Date().toISOString(),
        })
        .eq("id", warRoom.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return ok(data);
    }
    case "add_member": {
      if (!input.memberName) throw forbidden("memberName required");
      const { data, error } = await admin
        .from("war_room_members")
        .insert({
          tenant_id: input.tenantId,
          war_room_id: warRoom.id,
          member_name: input.memberName,
          role: input.memberRole ?? null,
          is_external: input.isExternal ?? false,
          added_by: actor.userId,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return ok(data, { status: 201 });
    }
    case "add_decision": {
      if (!input.decision || !input.reason || !input.approverName) {
        throw forbidden("decision, reason and approverName are required");
      }
      const { data, error } = await admin
        .from("war_room_decisions")
        .insert({
          tenant_id: input.tenantId,
          war_room_id: warRoom.id,
          decision: input.decision,
          options_considered: input.optionsConsidered ?? null,
          selected_option: input.selectedOption ?? null,
          reason: input.reason,
          approver_name: input.approverName,
          approver_user_id: actor.userId,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);

      await writeAuditLog({
        tenantId: input.tenantId,
        actorUserId: actor.userId,
        action: "war_room.decision_recorded",
        entityType: "war_room_decision",
        entityId: data.id,
        newValue: { decision: input.decision },
        reason: input.reason,
      });
      return ok(data, { status: 201 });
    }
    case "add_task": {
      if (!input.taskTitle) throw forbidden("taskTitle required");
      const { data, error } = await admin
        .from("war_room_tasks")
        .insert({
          tenant_id: input.tenantId,
          war_room_id: warRoom.id,
          title: input.taskTitle,
          assigned_to_name: input.taskAssignee ?? null,
          created_by: actor.userId,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return ok(data, { status: 201 });
    }
    case "add_message": {
      if (!input.message) throw forbidden("message required");
      const { data, error } = await admin
        .from("war_room_messages")
        .insert({
          tenant_id: input.tenantId,
          war_room_id: warRoom.id,
          body: input.message,
          created_by: actor.userId,
          created_by_name: actor.email,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return ok(data, { status: 201 });
    }
    default:
      throw forbidden("Unknown action");
  }
});
