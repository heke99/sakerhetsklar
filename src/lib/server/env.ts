import "server-only";

/**
 * Server-only environment access. Secrets are read lazily so that builds and
 * tests can run without a fully configured environment; any code path that
 * actually needs a secret fails loudly instead of silently degrading.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function optionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}

export const env = {
  get supabaseUrl(): string {
    return requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey(): string {
    return requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get supabaseServiceRoleKey(): string {
    return requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  },
  get webhookSigningSecret(): string {
    return requireEnv("WEBHOOK_SIGNING_SECRET");
  },
  get jobRunnerSecret(): string {
    return requireEnv("JOB_RUNNER_SECRET");
  },
  get appPrimaryHosts(): string[] {
    return (process.env.APP_PRIMARY_HOSTS ?? "localhost:3000")
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
  },
  get isConfigured(): boolean {
    return Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
  },
};
