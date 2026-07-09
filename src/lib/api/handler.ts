import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z, type ZodType } from "zod";

import { getActorContext, type ActorContext } from "@/lib/authz/context";
import { log } from "@/lib/server/log";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export const forbidden = (msg = "Forbidden") => new ApiError(403, msg, "forbidden");
export const notFound = (msg = "Not found") => new ApiError(404, msg, "not_found");
export const badRequest = (msg = "Bad request") => new ApiError(400, msg, "bad_request");

export interface RequestMeta {
  ipAddress: string | null;
  userAgent: string | null;
}

export function getRequestMeta(req: NextRequest): RequestMeta {
  return {
    ipAddress:
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: req.headers.get("user-agent"),
  };
}

type Handler<P> = (
  req: NextRequest,
  ctx: { actor: ActorContext; params: P; meta: RequestMeta },
) => Promise<NextResponse | Response>;

/**
 * Wraps an authenticated API route handler: resolves the actor context,
 * normalizes error handling, and never leaks internals in error responses.
 */
export function withApi<P = Record<string, string>>(handler: Handler<P>) {
  return async (
    req: NextRequest,
    routeCtx: { params: Promise<P> },
  ): Promise<Response> => {
    try {
      const actor = await getActorContext();
      if (!actor) {
        return NextResponse.json(
          { error: { code: "unauthorized", message: "Authentication required" } },
          { status: 401 },
        );
      }
      const params = await routeCtx.params;
      return await handler(req, { actor, params, meta: getRequestMeta(req) });
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json(
          { error: { code: err.code ?? "error", message: err.message } },
          { status: err.status },
        );
      }
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: {
              code: "validation_error",
              message: "Invalid request body",
              issues: err.issues,
            },
          },
          { status: 422 },
        );
      }
      log.error("api_unhandled_error", err, {
        path: req.nextUrl.pathname,
        method: req.method,
      });
      return NextResponse.json(
        { error: { code: "internal_error", message: "Internal server error" } },
        { status: 500 },
      );
    }
  };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validated `tenantId` query parameter: required and must be a UUID.
 * Malformed ids get 400 instead of reaching the database layer.
 */
export function requireTenantIdParam(req: NextRequest): string {
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  if (!tenantId) throw badRequest("tenantId is required");
  if (!UUID_RE.test(tenantId)) throw badRequest("tenantId must be a UUID");
  return tenantId;
}

export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw badRequest("Request body must be valid JSON");
  }
  return schema.parse(json);
}

export function ok(data: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, init);
}
