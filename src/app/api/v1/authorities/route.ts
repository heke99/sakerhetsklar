import { withApi, ok } from "@/lib/api/handler";
import { getAdminClient } from "@/lib/server/supabase-admin";

export const GET = withApi(async () => {
  const admin = getAdminClient();
  const [authoritiesRes, mappingsRes] = await Promise.all([
    admin.from("supervisory_authorities").select("*").order("code"),
    admin
      .from("sector_supervisory_authorities")
      .select("*")
      .order("sector_code"),
  ]);
  if (authoritiesRes.error) throw new Error(authoritiesRes.error.message);
  return ok({
    authorities: authoritiesRes.data ?? [],
    mappings: mappingsRes.data ?? [],
  });
});
