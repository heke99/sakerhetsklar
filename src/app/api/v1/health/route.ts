import { NextResponse } from "next/server";

/**
 * Public liveness endpoint: no dependencies, no sensitive details.
 * Operational readiness (DB/storage/config checks) lives at
 * /api/v1/health/readiness and requires authorization.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "sakerhetsklar",
    version: process.env.npm_package_version ?? "unknown",
    time: new Date().toISOString(),
  });
}
