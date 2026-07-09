import { NextResponse, type NextRequest } from "next/server";

import { isAuthorizedJobRequest } from "@/lib/server/job-auth";
import { runAnomalyScan } from "@/lib/services/security";

/** Scheduled anomaly scan (spec §38). Protected by the job runner secret. */
export async function POST(req: NextRequest) {
  if (!isAuthorizedJobRequest(req)) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Invalid job secret" } },
      { status: 401 },
    );
  }

  const result = await runAnomalyScan();
  return NextResponse.json({ data: result });
}
