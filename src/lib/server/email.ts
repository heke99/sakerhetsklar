import "server-only";

import { optionalEnv } from "./env";

/**
 * Transactional email via Resend's REST API. No mock success: when the
 * provider is not configured the caller gets `{ delivered: false }` and must
 * decide how to fail (invitations fail closed in production; see
 * services/invitations.ts).
 */

export function isEmailConfigured(): boolean {
  return Boolean(optionalEnv("RESEND_API_KEY") && optionalEnv("EMAIL_FROM"));
}

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<{ delivered: boolean; error?: string }> {
  const apiKey = optionalEnv("RESEND_API_KEY");
  const from = optionalEnv("EMAIL_FROM");
  if (!apiKey || !from) {
    return { delivered: false, error: "email_not_configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("email_delivery_failed", res.status, body.slice(0, 500));
      return { delivered: false, error: `provider_error_${res.status}` };
    }
    return { delivered: true };
  } catch (err) {
    console.error("email_delivery_failed", err);
    return { delivered: false, error: "network_error" };
  }
}
