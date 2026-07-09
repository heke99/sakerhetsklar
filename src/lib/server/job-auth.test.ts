import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { isAuthorizedJobRequest } from "./job-auth";

const URL = "http://localhost/api/v1/jobs/escalations";

function request(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(URL, { method: "POST", headers });
}

afterEach(() => {
  delete process.env.JOB_RUNNER_SECRET;
});

describe("isAuthorizedJobRequest", () => {
  it("rejects everything when JOB_RUNNER_SECRET is unset (fail closed)", () => {
    expect(isAuthorizedJobRequest(request())).toBe(false);
    expect(isAuthorizedJobRequest(request({ "x-job-secret": "anything" }))).toBe(false);
  });

  it("rejects missing or wrong secrets", () => {
    process.env.JOB_RUNNER_SECRET = "correct-secret";
    expect(isAuthorizedJobRequest(request())).toBe(false);
    expect(isAuthorizedJobRequest(request({ "x-job-secret": "wrong" }))).toBe(false);
    expect(
      isAuthorizedJobRequest(request({ authorization: "Bearer wrong" })),
    ).toBe(false);
  });

  it("accepts the x-job-secret header", () => {
    process.env.JOB_RUNNER_SECRET = "correct-secret";
    expect(
      isAuthorizedJobRequest(request({ "x-job-secret": "correct-secret" })),
    ).toBe(true);
  });

  it("accepts the Vercel Cron Authorization bearer convention", () => {
    process.env.JOB_RUNNER_SECRET = "correct-secret";
    expect(
      isAuthorizedJobRequest(request({ authorization: "Bearer correct-secret" })),
    ).toBe(true);
  });
});
