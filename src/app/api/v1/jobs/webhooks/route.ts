import { NextResponse, type NextRequest } from "next/server";

import { isAuthorizedJobRequest } from "@/lib/server/job-auth";
import { processWebhookDeliveries } from "@/lib/services/webhooks";

/** Webhook delivery job with retry logic. Protected by the job secret. */
export async function POST(req: NextRequest) {
  if (!isAuthorizedJobRequest(req)) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Invalid job secret" } },
      { status: 401 },
    );
  }
  const result = await processWebhookDeliveries();
  return NextResponse.json({ data: result });
}
