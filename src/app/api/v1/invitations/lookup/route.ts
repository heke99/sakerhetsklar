import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { ApiError, getRequestMeta } from "@/lib/api/handler";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { lookupInvitation } from "@/lib/services/invitations";

const schema = z.object({ token: z.string().min(32).max(128) });

/**
 * Public endpoint: resolves a raw invite token to safe invitation info for
 * the accept page. The token itself is the credential; invalid tokens get a
 * uniform 404. Rate limited per IP.
 */
export async function POST(req: NextRequest) {
  const meta = getRequestMeta(req);
  if (
    !checkRateLimit(`invite-lookup:${meta.ipAddress ?? "unknown"}`, {
      limit: 20,
      windowMs: 10 * 60_000,
    })
  ) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "För många försök. Vänta en stund." } },
      { status: 429 },
    );
  }

  try {
    const body = schema.parse(await req.json());
    const info = await lookupInvitation(body.token);
    return NextResponse.json({ data: info });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { error: { code: err.code ?? "error", message: err.message } },
        { status: err.status },
      );
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "validation_error", message: "Ogiltig förfrågan" } },
        { status: 422 },
      );
    }
    console.error("invite_lookup_error", err);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Internt fel" } },
      { status: 500 },
    );
  }
}
