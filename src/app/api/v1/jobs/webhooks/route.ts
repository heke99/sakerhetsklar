import { NextResponse, type NextRequest } from "next/server";

import { optionalEnv } from "@/lib/server/env";
import { processWebhookDeliveries } from "@/lib/services/webhooks";

/** Webhook delivery job with retry logic. Protected by the job secret. */
export async function POST(req: NextRequest) {
  const secret = optionalEnv("JOB_RUNNER_SECRET");
  if (!secret || req.headers.get("x-job-secret") !== secret) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Invalid job secret" } },
      { status: 401 },
    );
  }
  const result = await processWebhookDeliveries();
  return NextResponse.json({ data: result });
}
