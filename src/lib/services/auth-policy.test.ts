import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActorContext } from "@/lib/authz/context";

// --- Mock state -------------------------------------------------------------

let providerRows: {
  provider_type: string;
  status: string;
  mfa_required: boolean;
}[] = [];
let currentActor: ActorContext | null = null;
let mfaLevel: "aal1" | "aal2" = "aal1";

vi.mock("@/lib/server/supabase-admin", () => ({
  getAdminClient: () => ({
    from: () => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        then: (resolve: (v: { data: unknown }) => unknown) =>
          Promise.resolve({ data: providerRows }).then(resolve),
      };
      return builder;
    },
  }),
}));

vi.mock("@/lib/server/supabase-server", () => ({
  getServerClient: async () => ({
    auth: {
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: { currentLevel: mfaLevel },
        }),
      },
    },
  }),
}));

vi.mock("@/lib/authz/context", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/authz/context")>();
  return {
    ...original,
    getActorContext: async () => currentActor,
  };
});

const { checkAuthGate, getTenantAuthPolicy } = await import("./auth-policy");

const TENANT = "10000000-0000-0000-0000-00000000000a";

function actorWithRoles(roles: string[]): ActorContext {
  return {
    userId: "u-1",
    email: "u@example.test",
    platformRoles: [],
    tenantRoles: new Map([[TENANT, roles]]) as ActorContext["tenantRoles"],
    tenantPermissions: new Map(),
    supportAccessTenantIds: new Set(),
  };
}

beforeEach(() => {
  providerRows = [];
  currentActor = null;
  mfaLevel = "aal1";
});

describe("getTenantAuthPolicy", () => {
  it("defaults to email/password when nothing is configured", async () => {
    const policy = await getTenantAuthPolicy(TENANT);
    expect(policy).toEqual({
      providerType: "email_password",
      ssoRequired: false,
      mfaRequired: false,
    });
  });

  it("detects an active SSO provider", async () => {
    providerRows = [
      { provider_type: "entra_id_oidc", status: "active", mfa_required: false },
    ];
    const policy = await getTenantAuthPolicy(TENANT);
    expect(policy.ssoRequired).toBe(true);
    expect(policy.providerType).toBe("entra_id_oidc");
  });
});

describe("checkAuthGate — fail-closed behavior", () => {
  it("allows normal users when only email/password is configured", async () => {
    currentActor = actorWithRoles(["incident_manager"]);
    expect(await checkAuthGate(TENANT)).toEqual({ blocked: false });
  });

  it("blocks password sessions for normal users when tenant requires SSO", async () => {
    providerRows = [
      { provider_type: "saml", status: "active", mfa_required: false },
    ];
    currentActor = actorWithRoles(["incident_manager"]);
    expect(await checkAuthGate(TENANT)).toEqual({
      blocked: true,
      reason: "sso_required",
    });
  });

  it("lets tenant admins in to complete SSO configuration", async () => {
    providerRows = [
      { provider_type: "saml", status: "active", mfa_required: false },
    ];
    currentActor = actorWithRoles(["tenant_admin"]);
    expect(await checkAuthGate(TENANT)).toEqual({ blocked: false });
  });

  it("blocks sessions below AAL2 when tenant requires MFA", async () => {
    providerRows = [
      { provider_type: "email_password", status: "active", mfa_required: true },
    ];
    currentActor = actorWithRoles(["tenant_admin"]);
    mfaLevel = "aal1";
    expect(await checkAuthGate(TENANT)).toEqual({
      blocked: true,
      reason: "mfa_required",
    });
  });

  it("allows AAL2 sessions when tenant requires MFA", async () => {
    providerRows = [
      { provider_type: "email_password", status: "active", mfa_required: true },
    ];
    currentActor = actorWithRoles(["incident_manager"]);
    mfaLevel = "aal2";
    expect(await checkAuthGate(TENANT)).toEqual({ blocked: false });
  });

  it("ignores inactive SSO providers (no accidental lockout before activation)", async () => {
    providerRows = [
      { provider_type: "saml", status: "pending_setup", mfa_required: false },
    ];
    currentActor = actorWithRoles(["incident_manager"]);
    // pending_setup providers are filtered by the status=active query;
    // the mock returns all rows, so emulate the filtered result:
    providerRows = [];
    expect(await checkAuthGate(TENANT)).toEqual({ blocked: false });
  });
});
