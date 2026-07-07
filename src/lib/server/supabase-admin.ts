import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "./env";

let adminClient: SupabaseClient | null = null;

/**
 * Service-role client for the central data plane (Model A shared database).
 * Bypasses RLS — must only be used inside the server-side service layer after
 * authorization checks. Never import from client components.
 */
export function getAdminClient(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

/**
 * Service-role client for an isolated tenant data plane (Model B/C).
 * Connection details come from the control plane via the tenant resolver;
 * secrets are resolved from environment/secret-manager references and never
 * stored in the database or exposed to the client.
 */
export function getDataPlaneClient(connection: {
  url: string;
  serviceRoleKeyRef: string;
}): SupabaseClient {
  const key = process.env[connection.serviceRoleKeyRef];
  if (!key) {
    throw new Error(
      `Data-plane secret reference "${connection.serviceRoleKeyRef}" is not configured on the server.`,
    );
  }
  return createClient(connection.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
