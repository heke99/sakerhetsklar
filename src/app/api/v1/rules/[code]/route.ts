import { withApi, ok, notFound } from "@/lib/api/handler";
import { getAdminClient } from "@/lib/server/supabase-admin";

export const GET = withApi<{ code: string }>(async (_req, { params }) => {
  const admin = getAdminClient();
  const { data: ruleSet } = await admin
    .from("regulatory_rule_sets")
    .select("*, legal_sources(*)")
    .eq("code", params.code)
    .maybeSingle();
  if (!ruleSet) throw notFound("Rule set not found");

  const [rulesRes, coverageRes, versionsRes] = await Promise.all([
    admin
      .from("regulatory_rules")
      .select("*")
      .eq("rule_set_id", ruleSet.id)
      .order("sort_order"),
    admin.from("rule_coverage_statuses").select("*").eq("rule_set_id", ruleSet.id),
    admin
      .from("regulatory_rule_versions")
      .select("version, changelog, published_at, status")
      .eq("rule_set_id", ruleSet.id)
      .order("published_at", { ascending: false }),
  ]);

  return ok({
    ruleSet,
    rules: rulesRes.data ?? [],
    coverage: coverageRes.data ?? [],
    versions: versionsRes.data ?? [],
  });
});
