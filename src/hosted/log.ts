import type { LogLevel } from "./config.js";

/**
 * The JSON logger of the hosted server. It writes one JSON line for each
 * event to stdout. The stdio server uses src/logger.ts and stderr, because
 * its stdout is the protocol channel. The hosted server has no such channel.
 *
 * Never put a token in a field. The callers give only identifiers.
 */
export type LogFields = Record<string, string | number | boolean | null | undefined>;

export interface JsonLogger {
  debug(event: string, fields?: LogFields): void;
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}

const RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export function createJsonLogger(
  level: LogLevel,
  write: (line: string) => void = (line) => {
    process.stdout.write(line);
  },
): JsonLogger {
  const min = RANK[level];
  const emit = (lvl: LogLevel, event: string, fields?: LogFields): void => {
    if (RANK[lvl] < min) return;
    const record: Record<string, unknown> = { time: new Date().toISOString(), level: lvl, event };
    for (const [key, value] of Object.entries(fields ?? {})) {
      if (value !== undefined) record[key] = value;
    }
    write(`${JSON.stringify(record)}\n`);
  };
  return {
    debug: (event, fields) => emit("debug", event, fields),
    info: (event, fields) => emit("info", event, fields),
    warn: (event, fields) => emit("warn", event, fields),
    error: (event, fields) => emit("error", event, fields),
  };
}
