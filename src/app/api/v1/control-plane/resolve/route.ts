import { NextResponse, type NextRequest } from "next/server";

import { resolveTenantByHost } from "@/lib/tenant-resolver/service";

/**
 * Public bootstrap endpoint: resolves the current host to SAFE tenant config
 * (publishable key, auth provider, enabled modules). Unknown domains fail
 * closed with 404 and no detail that could aid enumeration.
 */
export async function GET(req: NextRequest) {
  const host = req.headers.get("host");
  const result = await resolveTenantByHost(host);

  if (!result.ok) {
    return NextResponse.json(
      { error: { code: "unknown_tenant", message: "Okänd domän" } },
      { status: 404 },
    );
  }

  return NextResponse.json({
    data: {
      environment: result.config.environment,
      deploymentModel: result.config.deploymentModel,
      enabledModules: result.config.enabledModules,
      authProviderType: result.config.authProviderType,
      supabaseUrl: result.config.supabaseUrl,
      publishableKey: result.config.publishableKey,
      apiBaseUrl: result.config.apiBaseUrl,
    },
  });
}
