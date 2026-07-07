import { withApi, ok } from "@/lib/api/handler";
import { getAdminClient } from "@/lib/server/supabase-admin";

export const GET = withApi(async () => {
  const admin = getAdminClient();
  const [sectorsRes, subsectorsRes] = await Promise.all([
    admin.from("sectors").select("*").order("code"),
    admin.from("subsectors").select("*").order("code"),
  ]);
  if (sectorsRes.error) throw new Error(sectorsRes.error.message);
  return ok({
    sectors: sectorsRes.data ?? [],
    subsectors: subsectorsRes.data ?? [],
  });
});
