import "server-only";

/**
 * Structured server logging (batch 17): single-line JSON to stdout/stderr so
 * any log collector (Vercel, CloudWatch, Loki, …) can parse it. Never log
 * secrets, evidence content or personal data — ids and metadata only.
 */

type Level = "info" | "warn" | "error";

export interface LogFields {
  [key: string]: string | number | boolean | null | undefined;
}

function emit(level: Level, event: string, fields: LogFields = {}): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, fields?: LogFields) => emit("info", event, fields),
  warn: (event: string, fields?: LogFields) => emit("warn", event, fields),
  error: (event: string, error?: unknown, fields?: LogFields) =>
    emit("error", event, {
      ...fields,
      message: error instanceof Error ? error.message : error ? String(error) : undefined,
    }),
};
