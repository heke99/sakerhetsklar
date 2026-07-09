import { describe, expect, it } from "vitest";

import {
  resolveEntitlement,
  type EntitlementRow,
  type FlagOverride,
} from "./resolve";

const planRows: EntitlementRow[] = [
  { entitlement_key: "war_room", enabled: true, limit_value: null },
  { entitlement_key: "users", enabled: true, limit_value: 5 },
  { entitlement_key: "sso_saml", enabled: false, limit_value: null },
];

describe("resolveEntitlement", () => {
  it("uses the plan row when present", () => {
    expect(resolveEntitlement("war_room", planRows, [])).toEqual({
      enabled: true,
      limit: null,
      source: "plan",
    });
    expect(resolveEntitlement("users", planRows, [])).toEqual({
      enabled: true,
      limit: 5,
      source: "plan",
    });
  });

  it("respects disabled plan rows", () => {
    expect(resolveEntitlement("sso_saml", planRows, []).enabled).toBe(false);
  });

  it("fails closed for keys without a plan row", () => {
    expect(resolveEntitlement("break_glass", planRows, [])).toEqual({
      enabled: false,
      limit: 0,
      source: "default",
    });
  });

  it("lets an explicit tenant override grant access (complimentary/internal)", () => {
    const overrides: FlagOverride[] = [{ flag_code: "ent:break_glass", enabled: true }];
    expect(resolveEntitlement("break_glass", planRows, overrides)).toEqual({
      enabled: true,
      limit: null,
      source: "override",
    });
  });

  it("lets an explicit tenant override revoke plan access", () => {
    const overrides: FlagOverride[] = [{ flag_code: "ent:war_room", enabled: false }];
    expect(resolveEntitlement("war_room", planRows, overrides).enabled).toBe(false);
  });

  it("ignores overrides for other keys", () => {
    const overrides: FlagOverride[] = [{ flag_code: "ent:war_room", enabled: false }];
    expect(resolveEntitlement("users", planRows, overrides).source).toBe("plan");
  });
});
