import { NextResponse, type NextRequest } from "next/server";

import { isAuthorizedJobRequest } from "@/lib/server/job-auth";
import { processDeadlineEscalations } from "@/lib/services/deadlines";

/**
 * Background job endpoint: processes deadline reminders, escalations, missed
 * deadlines and late-reporting record creation. Invoked by a scheduler (cron)
 * with the shared job secret — never exposed to browsers.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorizedJobRequest(req)) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Invalid job secret" } },
      { status: 401 },
    );
  }

  const result = await processDeadlineEscalations();
  return NextResponse.json({ data: result });
}
