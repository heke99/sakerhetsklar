import { z } from "zod";

import { withApi, ok, parseBody } from "@/lib/api/handler";
import { getAdminClient } from "@/lib/server/supabase-admin";

/** The current user's in-app notifications (self-scoped — no tenant leakage). */
export const GET = withApi(async (req, { actor }) => {
  const unreadOnly = req.nextUrl.searchParams.get("unread") === "true";

  const admin = getAdminClient();
  let query = admin
    .from("notifications")
    .select("*")
    .eq("user_id", actor.userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (unreadOnly) query = query.is("read_at", null);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ok(data);
});

const patchSchema = z.object({
  notificationIds: z.array(z.string().uuid()).max(200).optional(),
  markAllRead: z.boolean().optional(),
});

export const PATCH = withApi(async (req, { actor }) => {
  const input = await parseBody(req, patchSchema);
  const admin = getAdminClient();

  let query = admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", actor.userId)
    .is("read_at", null);
  if (!input.markAllRead) {
    if (!input.notificationIds || input.notificationIds.length === 0) {
      return ok({ updated: 0 });
    }
    query = query.in("id", input.notificationIds);
  }

  const { error } = await query;
  if (error) throw new Error(error.message);
  return ok({ updated: true });
});
