/**
 * Next.js instrumentation hook — runs once at server startup.
 * Validates required environment variables so a misconfigured production
 * deployment fails fast with a clear error instead of failing per-request.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateServerEnv } = await import("@/lib/server/env");
    validateServerEnv();
  }
}
