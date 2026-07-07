import { describe, expect, it } from "vitest";

import { normalizeHost, resolveFromRegistry } from "./resolve";
import type { DomainRegistryRow } from "./types";

const sharedDataPlane = {
  supabaseUrl: "https://shared.supabase.co",
  publishableKey: "publishable-shared",
  apiBaseUrl: "/api/v1",
};

function row(overrides: Partial<DomainRegistryRow> = {}): DomainRegistryRow {
  return {
    domain: "kund.sakerhetsklar.se",
    tenantId: "tenant-1",
    environment: "prod",
    domainStatus: "active",
    tenantStatus: "active",
    deploymentModel: "multi_tenant",
    enabledModules: ["incidents", "controls"],
    authProviderType: "email_password",
    dataPlane: null,
    ...overrides,
  };
}

function registryOf(...rows: DomainRegistryRow[]) {
  return new Map(rows.map((r) => [r.domain, r]));
}

describe("normalizeHost", () => {
  it("lowercases and strips port", () => {
    expect(normalizeHost("App.Sakerhetsklar.SE:3000")).toBe("app.sakerhetsklar.se");
  });

  it("rejects hosts with paths, credentials or whitespace (spoofing)", () => {
    expect(normalizeHost("evil.com/app.sakerhetsklar.se")).toBeNull();
    expect(normalizeHost("user@evil.com")).toBeNull();
    expect(normalizeHost("app.sakerhetsklar.se evil.com")).toBeNull();
    expect(normalizeHost("app.sakerhetsklar.se?x=1")).toBeNull();
    expect(normalizeHost("https://app.sakerhetsklar.se")).toBeNull();
  });

  it("rejects malformed labels", () => {
    expect(normalizeHost(".sakerhetsklar.se")).toBeNull();
    expect(normalizeHost("sakerhetsklar.se.")).toBeNull();
    expect(normalizeHost("a..b.se")).toBeNull();
    expect(normalizeHost("-bad.se")).toBeNull();
  });

  it("rejects empty and null", () => {
    expect(normalizeHost("")).toBeNull();
    expect(normalizeHost(null)).toBeNull();
    expect(normalizeHost(undefined)).toBeNull();
  });
});

describe("resolveFromRegistry", () => {
  it("resolves a known Model A domain to the shared data plane", () => {
    const result = resolveFromRegistry("kund.sakerhetsklar.se", registryOf(row()), sharedDataPlane);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.tenantId).toBe("tenant-1");
      expect(result.config.supabaseUrl).toBe(sharedDataPlane.supabaseUrl);
      expect(result.config.publishableKey).toBe(sharedDataPlane.publishableKey);
      expect(result.config.deploymentModel).toBe("multi_tenant");
    }
  });

  it("fails closed for unknown domains", () => {
    const result = resolveFromRegistry("unknown.example.se", registryOf(row()), sharedDataPlane);
    expect(result).toEqual({ ok: false, reason: "unknown_domain" });
  });

  it("fails closed for invalid/spoofed hosts", () => {
    const result = resolveFromRegistry(
      "kund.sakerhetsklar.se@evil.com",
      registryOf(row()),
      sharedDataPlane,
    );
    expect(result).toEqual({ ok: false, reason: "invalid_host" });
  });

  it("does not leak another tenant's config (cross-tenant)", () => {
    const registry = registryOf(
      row(),
      row({
        domain: "malmo.sakerhetsklar.se",
        tenantId: "tenant-malmo",
        deploymentModel: "single_tenant",
        dataPlane: {
          status: "active",
          supabaseUrl: "https://malmo.supabase.co",
          publishableKey: "publishable-malmo",
          apiBaseUrl: "https://malmo.sakerhetsklar.se/api/v1",
          environment: "prod",
        },
      }),
    );

    const a = resolveFromRegistry("kund.sakerhetsklar.se", registry, sharedDataPlane);
    const b = resolveFromRegistry("malmo.sakerhetsklar.se", registry, sharedDataPlane);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.config.tenantId).not.toBe(b.config.tenantId);
      expect(a.config.publishableKey).not.toBe(b.config.publishableKey);
      expect(b.config.supabaseUrl).toBe("https://malmo.supabase.co");
    }
  });

  it("fails closed for disabled tenant", () => {
    const result = resolveFromRegistry(
      "kund.sakerhetsklar.se",
      registryOf(row({ tenantStatus: "disabled" })),
      sharedDataPlane,
    );
    expect(result).toEqual({ ok: false, reason: "tenant_disabled" });
  });

  it("fails closed for paused tenant", () => {
    const result = resolveFromRegistry(
      "kund.sakerhetsklar.se",
      registryOf(row({ tenantStatus: "paused" })),
      sharedDataPlane,
    );
    expect(result).toEqual({ ok: false, reason: "tenant_paused" });
  });

  it("fails closed for disabled domain", () => {
    const result = resolveFromRegistry(
      "kund.sakerhetsklar.se",
      registryOf(row({ domainStatus: "disabled" })),
      sharedDataPlane,
    );
    expect(result).toEqual({ ok: false, reason: "domain_disabled" });
  });

  it("routes Model B tenants to their isolated data plane", () => {
    const result = resolveFromRegistry(
      "helsingborg.sakerhetsklar.se",
      registryOf(
        row({
          domain: "helsingborg.sakerhetsklar.se",
          tenantId: "tenant-hbg",
          deploymentModel: "single_tenant",
          dataPlane: {
            status: "active",
            supabaseUrl: "https://hbg.supabase.co",
            publishableKey: "publishable-hbg",
            apiBaseUrl: null,
            environment: "prod",
          },
        }),
      ),
      sharedDataPlane,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.supabaseUrl).toBe("https://hbg.supabase.co");
      expect(result.config.apiBaseUrl).toBe(sharedDataPlane.apiBaseUrl);
    }
  });

  it("routes Model C tenants to the customer-owned data plane", () => {
    const result = resolveFromRegistry(
      "nis2.malmo.se",
      registryOf(
        row({
          domain: "nis2.malmo.se",
          tenantId: "tenant-malmo",
          deploymentModel: "customer_owned",
          dataPlane: {
            status: "active",
            supabaseUrl: "https://malmo-owned.supabase.co",
            publishableKey: "publishable-malmo-owned",
            apiBaseUrl: "https://api.malmo.se/sakerhetsklar",
            environment: "prod",
          },
        }),
      ),
      sharedDataPlane,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.supabaseUrl).toBe("https://malmo-owned.supabase.co");
      expect(result.config.apiBaseUrl).toBe("https://api.malmo.se/sakerhetsklar");
    }
  });

  it("fails closed when Model B/C data plane is inactive", () => {
    const result = resolveFromRegistry(
      "kund.sakerhetsklar.se",
      registryOf(
        row({
          deploymentModel: "single_tenant",
          dataPlane: {
            status: "inactive",
            supabaseUrl: "https://x.supabase.co",
            publishableKey: "pk",
            apiBaseUrl: null,
            environment: "prod",
          },
        }),
      ),
      sharedDataPlane,
    );
    expect(result).toEqual({ ok: false, reason: "data_plane_inactive" });
  });

  it("fails closed when Model B/C data plane is missing", () => {
    const result = resolveFromRegistry(
      "kund.sakerhetsklar.se",
      registryOf(row({ deploymentModel: "customer_owned", dataPlane: null })),
      sharedDataPlane,
    );
    expect(result).toEqual({ ok: false, reason: "data_plane_missing" });
  });

  it("fails closed on environment mismatch between domain and data plane", () => {
    const result = resolveFromRegistry(
      "kund.sakerhetsklar.se",
      registryOf(
        row({
          environment: "prod",
          deploymentModel: "single_tenant",
          dataPlane: {
            status: "active",
            supabaseUrl: "https://x.supabase.co",
            publishableKey: "pk",
            apiBaseUrl: null,
            environment: "stage",
          },
        }),
      ),
      sharedDataPlane,
    );
    expect(result).toEqual({ ok: false, reason: "environment_mismatch" });
  });

  it("falls back to email/password when auth provider is missing", () => {
    const result = resolveFromRegistry(
      "kund.sakerhetsklar.se",
      registryOf(row({ authProviderType: null })),
      sharedDataPlane,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.config.authProviderType).toBe("email_password");
  });

  it("never includes secret material in resolved config", () => {
    const result = resolveFromRegistry("kund.sakerhetsklar.se", registryOf(row()), sharedDataPlane);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const json = JSON.stringify(result.config).toLowerCase();
      expect(json).not.toContain("service_role");
      expect(json).not.toContain("secret");
      expect(json).not.toContain("db_url");
    }
  });
});
