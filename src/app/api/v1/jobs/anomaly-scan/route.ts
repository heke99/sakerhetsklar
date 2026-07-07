import { NextResponse, type NextRequest } from "next/server";

import { optionalEnv } from "@/lib/server/env";
import { runAnomalyScan } from "@/lib/services/security";

/** Scheduled anomaly scan (spec §38). Protected by the job runner secret. */
export async function POST(req: NextRequest) {
  const secret = optionalEnv("JOB_RUNNER_SECRET");
  const provided = req.headers.get("x-job-secret");
  if (!secret || provided !== secret) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Invalid job secret" } },
      { status: 401 },
    );
  }

  const result = await runAnomalyScan();
  return NextResponse.json({ data: result });
}
