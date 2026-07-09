import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/handler";
import type { ActorContext } from "./context";

// ---------------------------------------------------------------------------
// Admin client mock: a chainable, awaitable query builder whose result is
// programmed per test via `nextResults`.
// ---------------------------------------------------------------------------

type QueryResult = { data: unknown; error: { message: string } | null };
const nextResults: QueryResult[] = [];

function makeBuilder(): Record<string, unknown> {
  const result: QueryResult = nextResults.shift() ?? { data: null, error: null };
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "is", "order", "limit"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(async () => result);
  // The builder itself is awaitable (PostgREST-style thenable).
  builder.then = (resolve: (v: QueryResult) => unknown) =>
    Promise.resolve(result).then(resolve);
  return builder;
}

vi.mock("@/lib/server/supabase-admin", () => ({
  getAdminClient: () => ({ from: vi.fn(() => makeBuilder()) }),
}));

const {
  assertTenantAccess,
  assertTenantEntity,
  assertAllTenantEntities,
  resolveTenantFromEntity,
  assertIncidentTenant,
} = await import("./tenant-guards");

const TENANT_A = "10000000-0000-0000-0000-00000000000a";
const TENANT_B = "10000000-0000-0000-0000-00000000000b";
const ENTITY_ID = "21000000-0000-0000-0000-000000000001";

function actorFor(
  tenantId: string,
  permissions: string[] = [],
): ActorContext {
  return {
    userId: "u-1",
    email: "user@example.test",
    platformRoles: [],
    tenantRoles: new Map([[tenantId, ["tenant_admin"]]]) as ActorContext["tenantRoles"],
    tenantPermissions: new Map([
      [tenantId, new Set(permissions)],
    ]) as ActorContext["tenantPermissions"],
    supportAccessTenantIds: new Set<string>(),
  };
}

beforeEach(() => {
  nextResults.length = 0;
});

describe("assertTenantAccess", () => {
  it("passes for a member with the required permission", () => {
    const actor = actorFor(TENANT_A, ["incidents.write"]);
    expect(() =>
      assertTenantAccess(actor, TENANT_A, "incidents.write"),
    ).not.toThrow();
  });

  it("throws 403 for a non-member", () => {
    const actor = actorFor(TENANT_A);
    expect(() => assertTenantAccess(actor, TENANT_B)).toThrowError(ApiError);
    try {
      assertTenantAccess(actor, TENANT_B);
    } catch (e) {
      expect((e as ApiError).status).toBe(403);
    }
  });

  it("throws 403 when the permission is missing", () => {
    const actor = actorFor(TENANT_A, ["incidents.read"]);
    expect(() =>
      assertTenantAccess(actor, TENANT_A, "incidents.write"),
    ).toThrowError(ApiError);
  });
});

describe("assertTenantEntity", () => {
  it("passes when the row exists in the tenant", async () => {
    nextResults.push({ data: { id: ENTITY_ID }, error: null });
    await expect(
      assertTenantEntity("incidents", ENTITY_ID, TENANT_A),
    ).resolves.toBeUndefined();
  });

  it("throws 404 when the row belongs to another tenant (or does not exist)", async () => {
    nextResults.push({ data: null, error: null });
    await expect(
      assertTenantEntity("incidents", ENTITY_ID, TENANT_A),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("assertAllTenantEntities", () => {
  it("does nothing for an empty id list", async () => {
    await expect(
      assertAllTenantEntities("systems", [], TENANT_A),
    ).resolves.toBeUndefined();
  });

  it("passes when every id belongs to the tenant", async () => {
    nextResults.push({ data: [{ id: "id-1" }, { id: "id-2" }], error: null });
    await expect(
      assertAllTenantEntities("systems", ["id-1", "id-2"], TENANT_A),
    ).resolves.toBeUndefined();
  });

  it("throws 404 when any id is missing or cross-tenant", async () => {
    nextResults.push({ data: [{ id: "id-1" }], error: null });
    await expect(
      assertAllTenantEntities("systems", ["id-1", "id-2"], TENANT_A),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("resolveTenantFromEntity", () => {
  it("returns the owning tenant id", async () => {
    nextResults.push({ data: { tenant_id: TENANT_A }, error: null });
    await expect(
      resolveTenantFromEntity("incidents", ENTITY_ID),
    ).resolves.toBe(TENANT_A);
  });

  it("returns null when the row does not exist", async () => {
    nextResults.push({ data: null, error: null });
    await expect(
      resolveTenantFromEntity("incidents", ENTITY_ID),
    ).resolves.toBeNull();
  });
});

describe("assertIncidentTenant", () => {
  it("returns the resolved tenant for a member", async () => {
    nextResults.push({ data: { tenant_id: TENANT_A }, error: null });
    const actor = actorFor(TENANT_A);
    await expect(
      assertIncidentTenant(actor, ENTITY_ID, TENANT_A),
    ).resolves.toBe(TENANT_A);
  });

  it("throws 404 when the client-supplied tenant does not match the real owner", async () => {
    nextResults.push({ data: { tenant_id: TENANT_B }, error: null });
    const actor = actorFor(TENANT_A);
    await expect(
      assertIncidentTenant(actor, ENTITY_ID, TENANT_A),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("throws 404 (not 403) when the actor is not a member of the owning tenant", async () => {
    nextResults.push({ data: { tenant_id: TENANT_B }, error: null });
    const actor = actorFor(TENANT_A);
    await expect(
      assertIncidentTenant(actor, ENTITY_ID),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("throws 403 when the member lacks the required permission", async () => {
    nextResults.push({ data: { tenant_id: TENANT_A }, error: null });
    const actor = actorFor(TENANT_A, []);
    await expect(
      assertIncidentTenant(actor, ENTITY_ID, TENANT_A, "incidents.write"),
    ).rejects.toMatchObject({ status: 403 });
  });
});
