import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { ApiError, getRequestMeta } from "@/lib/api/handler";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { getCurrentUser } from "@/lib/server/supabase-server";
import { acceptInvitation } from "@/lib/services/invitations";

const schema = z.object({
  token: z.string().min(32).max(128),
  password: z.string().min(12).max(200).optional(),
});

/**
 * Public endpoint: accepts an invitation. The raw token is the credential.
 * New users supply a password (account is created server-side, email
 * pre-confirmed by mailbox access); existing users must be logged in as the
 * invited address. Rate limited per IP.
 */
export async function POST(req: NextRequest) {
  const meta = getRequestMeta(req);
  if (
    !checkRateLimit(`invite-accept:${meta.ipAddress ?? "unknown"}`, {
      limit: 10,
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
    const user = await getCurrentUser();
    const result = await acceptInvitation({
      token: body.token,
      password: body.password,
      authenticatedUserId: user?.id,
      authenticatedEmail: user?.email ?? null,
    });
    return NextResponse.json({ data: result });
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
            message: "Lösenordet måste vara minst 12 tecken.",
          },
        },
        { status: 422 },
      );
    }
    console.error("invite_accept_error", err);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Internt fel" } },
      { status: 500 },
    );
  }
}
