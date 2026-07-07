import { withApi, ok } from "@/lib/api/handler";
import { getAdminClient } from "@/lib/server/supabase-admin";

export const GET = withApi(async () => {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("regulatory_rule_sets")
    .select("code, name, status, coverage_status, manual_review_required, requires_update_when_final, version, effective_from, effective_to, description_sv, upload_warning")
    .order("code");
  if (error) throw new Error(error.message);
  return ok(data);
});
