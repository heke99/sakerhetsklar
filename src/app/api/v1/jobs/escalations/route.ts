import { NextResponse, type NextRequest } from "next/server";

import { optionalEnv } from "@/lib/server/env";
import { processDeadlineEscalations } from "@/lib/services/deadlines";

/**
 * Background job endpoint: processes deadline reminders, escalations, missed
 * deadlines and late-reporting record creation. Invoked by a scheduler (cron)
 * with the shared job secret — never exposed to browsers.
 */
export async function POST(req: NextRequest) {
  const secret = optionalEnv("JOB_RUNNER_SECRET");
  const provided = req.headers.get("x-job-secret");
  if (!secret || provided !== secret) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Invalid job secret" } },
      { status: 401 },
    );
  }

  const result = await processDeadlineEscalations();
  return NextResponse.json({ data: result });
}
