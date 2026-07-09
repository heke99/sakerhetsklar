import { describe, expect, it } from "vitest";

import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("returns the fallback for missing values", () => {
    expect(safeNextPath(null)).toBe("/app/overview");
    expect(safeNextPath("")).toBe("/app/overview");
  });

  it("allows same-origin relative paths", () => {
    expect(safeNextPath("/app/incidents")).toBe("/app/incidents");
    expect(safeNextPath("/platform/tenants")).toBe("/platform/tenants");
    expect(safeNextPath("/invite/accept?token=abc")).toBe("/invite/accept?token=abc");
  });

  it("blocks absolute URLs", () => {
    expect(safeNextPath("https://evil.example")).toBe("/app/overview");
    expect(safeNextPath("http://evil.example/app")).toBe("/app/overview");
  });

  it("blocks protocol-relative URLs", () => {
    expect(safeNextPath("//evil.example")).toBe("/app/overview");
    expect(safeNextPath("//evil.example/app")).toBe("/app/overview");
  });

  it("blocks backslash tricks", () => {
    expect(safeNextPath("/\\evil.example")).toBe("/app/overview");
    expect(safeNextPath("\\/evil.example")).toBe("/app/overview");
  });
});
