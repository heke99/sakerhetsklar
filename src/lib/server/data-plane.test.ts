import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mock state -------------------------------------------------------------

let tenantRow: { deployment_model: string } | null = null;
let connectionRow: {
  supabase_url: string | null;
  service_role_key_ref: string | null;
  status: string;
} | null = null;

const centralClient = { kind: "central" };
const isolatedClient = { kind: "isolated" };
const dataPlaneClientCalls: unknown[] = [];

function tableBuilder(table: string) {
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "eq"]) builder[m] = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => ({
    data: table === "tenants" ? tenantRow : connectionRow,
    error: null,
  }));
  return builder;
}

vi.mock("./supabase-admin", () => ({
  getAdminClient: () => ({
    ...centralClient,
    from: vi.fn((table: string) => tableBuilder(table)),
  }),
  getDataPlaneClient: (connection: unknown) => {
    dataPlaneClientCalls.push(connection);
    return isolatedClient;
  },
}));

const {
  DataPlaneNotReadyError,
  assertDataPlaneReady,
  filterTenantsWithUnreadyDataPlane,
  getTenantDataPlaneClient,
  invalidateDataPlaneCache,
  resolveTenantDeploymentModel,
} = await import("./data-plane");

const TENANT = "10000000-0000-0000-0000-00000000000a";

beforeEach(() => {
  tenantRow = null;
  connectionRow = null;
  dataPlaneClientCalls.length = 0;
  invalidateDataPlaneCache();
  delete process.env.TEST_PLANE_KEY;
});

describe("Model A (multi_tenant)", () => {
  it("returns the central client", async () => {
    tenantRow = { deployment_model: "multi_tenant" };
    const client = await getTenantDataPlaneClient(TENANT);
    expect((client as unknown as { kind: string }).kind).toBe("central");
    expect(await resolveTenantDeploymentModel(TENANT)).toBe("multi_tenant");
  });
});

describe("Model B/C fail-closed behavior", () => {
  it("throws when no data-plane connection exists", async () => {
    tenantRow = { deployment_model: "single_tenant" };
    connectionRow = null;
    await expect(getTenantDataPlaneClient(TENANT)).rejects.toBeInstanceOf(
      DataPlaneNotReadyError,
    );
    const status = await assertDataPlaneReady(TENANT);
    expect(status).toMatchObject({
      model: "single_tenant",
      ready: false,
      reason: "no_data_plane_connection",
    });
  });

  it("throws when the connection is not active", async () => {
    tenantRow = { deployment_model: "customer_owned" };
    connectionRow = {
      supabase_url: "https://plane.example",
      service_role_key_ref: "TEST_PLANE_KEY",
      status: "provisioning",
    };
    await expect(getTenantDataPlaneClient(TENANT)).rejects.toBeInstanceOf(
      DataPlaneNotReadyError,
    );
    expect((await assertDataPlaneReady(TENANT)).reason).toBe(
      "connection_provisioning",
    );
  });

  it("throws when the server-side secret reference is not configured", async () => {
    tenantRow = { deployment_model: "single_tenant" };
    connectionRow = {
      supabase_url: "https://plane.example",
      service_role_key_ref: "TEST_PLANE_KEY",
      status: "active",
    };
    await expect(getTenantDataPlaneClient(TENANT)).rejects.toBeInstanceOf(
      DataPlaneNotReadyError,
    );
    expect((await assertDataPlaneReady(TENANT)).reason).toBe(
      "secret_not_configured",
    );
  });

  it("never falls back to the central client for Model B/C", async () => {
    tenantRow = { deployment_model: "single_tenant" };
    connectionRow = null;
    try {
      await getTenantDataPlaneClient(TENANT);
    } catch {
      // expected
    }
    expect(dataPlaneClientCalls).toHaveLength(0);
  });

  it("returns the isolated client when fully provisioned", async () => {
    tenantRow = { deployment_model: "single_tenant" };
    connectionRow = {
      supabase_url: "https://plane.example",
      service_role_key_ref: "TEST_PLANE_KEY",
      status: "active",
    };
    process.env.TEST_PLANE_KEY = "secret-value";
    const client = await getTenantDataPlaneClient(TENANT);
    expect((client as unknown as { kind: string }).kind).toBe("isolated");
    expect(dataPlaneClientCalls).toEqual([
      { url: "https://plane.example", serviceRoleKeyRef: "TEST_PLANE_KEY" },
    ]);
  });
});

describe("filterTenantsWithUnreadyDataPlane", () => {
  it("flags unprovisioned B/C tenants and passes Model A tenants", async () => {
    tenantRow = { deployment_model: "single_tenant" };
    connectionRow = null;
    const unready = await filterTenantsWithUnreadyDataPlane([TENANT]);
    expect(unready.has(TENANT)).toBe(true);

    invalidateDataPlaneCache();
    tenantRow = { deployment_model: "multi_tenant" };
    const ok = await filterTenantsWithUnreadyDataPlane([TENANT]);
    expect(ok.has(TENANT)).toBe(false);
  });

  it("flags unknown tenants as unready (fail closed)", async () => {
    tenantRow = null;
    const unready = await filterTenantsWithUnreadyDataPlane([TENANT]);
    expect(unready.has(TENANT)).toBe(true);
  });
});
