/**
 * Evidence file policy: allowed types and size limits by plan (batch 10).
 * Pure logic — unit tested. Enforced server-side at upload time.
 */

const ALLOWED_EXTENSIONS = new Set([
  // Documents
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "rtf",
  // Text/logs/data
  "txt", "csv", "log", "json", "xml", "yaml", "yml", "md",
  // Images
  "png", "jpg", "jpeg", "gif", "webp", "svg", "tiff", "bmp",
  // Mail
  "eml", "msg",
  // Archives (subject to malware scanning when enabled)
  "zip", "7z", "gz", "tar",
  // Forensics/network captures
  "pcap", "pcapng", "har",
]);

const BLOCKED_EXTENSIONS = new Set([
  "exe", "dll", "so", "dylib", "bat", "cmd", "com", "cpl", "msi", "msp",
  "scr", "vbs", "vbe", "js", "jse", "ws", "wsf", "wsh", "ps1", "psm1",
  "sh", "bash", "app", "jar", "hta", "lnk", "reg",
]);

/** Max upload size in bytes per plan. */
export const PLAN_MAX_FILE_BYTES: Record<string, number> = {
  starter: 25 * 1024 * 1024,
  business: 50 * 1024 * 1024,
  enterprise: 100 * 1024 * 1024,
};

const DEFAULT_MAX_BYTES = PLAN_MAX_FILE_BYTES.starter;

export type FilePolicyResult =
  | { ok: true }
  | { ok: false; code: "blocked_type" | "unknown_type" | "too_large"; reasonSv: string };

export function validateEvidenceFile(input: {
  fileName: string;
  sizeBytes: number;
  plan?: string | null;
}): FilePolicyResult {
  const ext = input.fileName.split(".").pop()?.toLowerCase() ?? "";

  if (BLOCKED_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      code: "blocked_type",
      reasonSv: `Filtypen .${ext} är blockerad av säkerhetsskäl (körbar fil/skript).`,
    };
  }
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      code: "unknown_type",
      reasonSv: `Filtypen .${ext || "(saknas)"} tillåts inte som bevisfil. Kontakta support om filtypen behövs.`,
    };
  }

  const maxBytes = PLAN_MAX_FILE_BYTES[input.plan ?? ""] ?? DEFAULT_MAX_BYTES;
  if (input.sizeBytes > maxBytes) {
    return {
      ok: false,
      code: "too_large",
      reasonSv: `Filen är för stor (${Math.round(input.sizeBytes / 1024 / 1024)} MB). Max för er plan är ${Math.round(maxBytes / 1024 / 1024)} MB.`,
    };
  }

  return { ok: true };
}
