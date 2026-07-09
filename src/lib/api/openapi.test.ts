import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { openApiDoc } from "./openapi";

/**
 * Contract tests: every implemented /api/v1 route must be documented in the
 * OpenAPI document with exactly the HTTP methods it implements, and every
 * documented path must exist in the codebase. Route/spec drift fails CI.
 */

const API_ROOT = join(process.cwd(), "src/app/api/v1");

function collectRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectRouteFiles(full));
    } else if (entry === "route.ts") {
      out.push(full);
    }
  }
  return out;
}

function routePathToOpenApiPath(file: string): string {
  const rel = file
    .slice(API_ROOT.length)
    .replace(/\/route\.ts$/, "")
    .replace(/\[(\w+)\]/g, "{$1}");
  return rel === "" ? "/" : rel;
}

function implementedMethods(file: string): string[] {
  const src = readFileSync(file, "utf8");
  const methods: string[] = [];
  for (const m of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
    if (
      new RegExp(`export const ${m}\\b`).test(src) ||
      new RegExp(`export async function ${m}\\b`).test(src)
    ) {
      methods.push(m.toLowerCase());
    }
  }
  return methods;
}

const routeFiles = collectRouteFiles(API_ROOT);
const documentedPaths = openApiDoc.paths as Record<string, Record<string, unknown>>;

describe("OpenAPI contract", () => {
  it("finds route files (sanity)", () => {
    expect(routeFiles.length).toBeGreaterThan(40);
  });

  for (const file of routeFiles) {
    const apiPath = routePathToOpenApiPath(file);

    it(`documents ${apiPath}`, () => {
      expect(
        documentedPaths[apiPath],
        `Route ${apiPath} (from ${file}) is missing in the OpenAPI document`,
      ).toBeDefined();
    });

    it(`documents the implemented methods of ${apiPath}`, () => {
      const doc = documentedPaths[apiPath];
      if (!doc) return; // covered by the previous assertion
      const documented = Object.keys(doc).filter((k) =>
        ["get", "post", "put", "patch", "delete"].includes(k),
      );
      expect(new Set(documented)).toEqual(new Set(implementedMethods(file)));
    });
  }

  it("has no documented paths without an implementation", () => {
    const implemented = new Set(routeFiles.map(routePathToOpenApiPath));
    const phantom = Object.keys(documentedPaths).filter(
      (p) => !implemented.has(p),
    );
    expect(phantom, `Documented but not implemented: ${phantom.join(", ")}`).toEqual([]);
  });

  it("declares the standard error schema and security schemes", () => {
    expect(openApiDoc.components.schemas.Error).toBeDefined();
    expect(openApiDoc.components.securitySchemes.sessionCookie).toBeDefined();
    expect(openApiDoc.components.securitySchemes.jobSecret).toBeDefined();
  });
});
