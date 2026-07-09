import { describe, expect, it } from "vitest";

import { validateEvidenceFile, PLAN_MAX_FILE_BYTES } from "./file-policy";

describe("validateEvidenceFile", () => {
  it("allows common document/evidence types", () => {
    for (const name of ["rapport.pdf", "logg.txt", "bild.png", "capture.pcap", "mail.eml"]) {
      expect(
        validateEvidenceFile({ fileName: name, sizeBytes: 1024, plan: "starter" }),
      ).toEqual({ ok: true });
    }
  });

  it("blocks executables and scripts", () => {
    for (const name of ["virus.exe", "run.ps1", "macro.vbs", "evil.bat", "payload.js"]) {
      const result = validateEvidenceFile({
        fileName: name,
        sizeBytes: 1024,
        plan: "enterprise",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("blocked_type");
    }
  });

  it("rejects unknown extensions (allowlist, not blocklist-only)", () => {
    const result = validateEvidenceFile({
      fileName: "data.xyz",
      sizeBytes: 1024,
      plan: "starter",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unknown_type");
  });

  it("enforces plan-based size limits", () => {
    const overStarter = PLAN_MAX_FILE_BYTES.starter + 1;
    const starter = validateEvidenceFile({
      fileName: "big.pdf",
      sizeBytes: overStarter,
      plan: "starter",
    });
    expect(starter.ok).toBe(false);
    if (!starter.ok) expect(starter.code).toBe("too_large");

    const enterprise = validateEvidenceFile({
      fileName: "big.pdf",
      sizeBytes: overStarter,
      plan: "enterprise",
    });
    expect(enterprise.ok).toBe(true);
  });

  it("falls back to the starter limit for unknown plans", () => {
    const result = validateEvidenceFile({
      fileName: "big.pdf",
      sizeBytes: PLAN_MAX_FILE_BYTES.starter + 1,
      plan: null,
    });
    expect(result.ok).toBe(false);
  });
});
