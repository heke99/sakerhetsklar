/**
 * Only allow same-origin relative paths as post-login redirect targets.
 * Blocks open redirects like `next=https://evil.example`, `next=//evil` and
 * backslash tricks (`/\evil.example`).
 */
export function safeNextPath(raw: string | null): string {
  const fallback = "/app/overview";
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return fallback;
  }
  return raw;
}
