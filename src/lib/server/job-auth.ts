import "server-only";

import { timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";

import { optionalEnv } from "./env";

function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Job endpoint authentication (fail closed):
 *
 * - `x-job-secret: <JOB_RUNNER_SECRET>` — generic scheduler header.
 * - `Authorization: Bearer <JOB_RUNNER_SECRET>` — Vercel Cron convention
 *   (set CRON_SECRET to the same value as JOB_RUNNER_SECRET).
 *
 * When JOB_RUNNER_SECRET is unset, ALL requests are rejected.
 */
export function isAuthorizedJobRequest(req: NextRequest): boolean {
  const secret = optionalEnv("JOB_RUNNER_SECRET");
  if (!secret) return false;

  const header = req.headers.get("x-job-secret");
  if (header && safeEquals(header, secret)) return true;

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ") && safeEquals(auth.slice(7), secret)) {
    return true;
  }
  return false;
}
