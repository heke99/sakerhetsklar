import "server-only";

/**
 * Simple in-memory sliding-window rate limiter for abuse protection on
 * sensitive endpoints (invitation lookup/accept, password reset, login
 * helpers). Per-process only — in a multi-instance deployment each instance
 * keeps its own window, which still bounds abuse per instance. For strict
 * global limits put a rate-limiting proxy/WAF in front (documented in
 * docs/security).
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

// Periodically drop expired windows so the map cannot grow unbounded.
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanup(now: number): void {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, win] of windows) {
    if (win.resetAt <= now) windows.delete(key);
  }
}

/**
 * Returns true when the call is allowed, false when the limit is exceeded.
 * `key` should combine the endpoint and a client identifier (IP address).
 */
export function checkRateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): boolean {
  const now = Date.now();
  cleanup(now);

  const win = windows.get(key);
  if (!win || win.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  win.count += 1;
  return win.count <= limit;
}

/** Test helper: clears all rate-limit state. */
export function resetRateLimits(): void {
  windows.clear();
}
