/**
 * Production-ready structured logger for the OCR / question-extraction pipeline.
 *
 * Design goals:
 *   - Every log line carries stable context (documentId, fileId, pageNo, pageId,
 *     stage, attempt) so errors are traceable across the two-stage flow.
 *   - JSON output in production for log aggregation (Datadog, CloudWatch, etc.).
 *   - Human-readable output in local development.
 *   - `error()` serializes the full Error — including custom properties like
 *     `validationErrors`, `rawOutput`, `entityIndex`, `stage` — so nothing is
 *     lost (e.g. "entities.45: Each entity must be one of..." shows the entity
 *     index, the failing schema rule, the page, and the raw LLM output).
 */
import type { LogLevel } from "./logger.types";

export interface LogContext {
  documentId?: string;
  fileId?: string;
  pageNo?: number;
  pageId?: string;
  stage?: string;
  attempt?: number;
  entityIndex?: number;
  [key: string]: unknown;
}

/** Shape of a serialized log record emitted to stdout/stderr. */
export interface LogRecord {
  level: LogLevel;
  message: string;
  timestamp: string;
  context: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    [key: string]: unknown;
  };
}

type LogMethod = (message: string, context?: LogContext) => void;

export interface StructuredLogger {
  debug: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: (message: string, context?: LogContext, error?: unknown) => void;
  child: (context: LogContext) => StructuredLogger;
}

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Serializes an Error (or any thrown value) into a plain object, preserving
 * custom enumerable properties (validationErrors, rawOutput, entityIndex, …)
 * that would otherwise be lost by JSON.stringify(error) alone.
 */
function serializeError(value: unknown): LogRecord["error"] {
  if (value instanceof Error) {
    const custom: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      if (["name", "message", "stack"].includes(key)) continue;
      custom[key] = (value as Record<string, unknown>)[key];
    }
    return {
      name: value.name,
      message: value.message,
      ...(value.stack ? { stack: value.stack } : {}),
      ...custom,
    };
  }
  if (typeof value === "string") {
    return { name: "ThrownString", message: value };
  }
  return { name: "Unknown", message: String(value) };
}

function formatRecord(record: LogRecord): string {
  if (isProduction()) {
    return JSON.stringify(record);
  }

  const ctxParts = Object.entries(record.context)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => {
      const serialized =
        typeof v === "object" ? JSON.stringify(v) : String(v);
      return `${k}=${serialized}`;
    })
    .join(" ");

  const prefix = `[${record.timestamp}] [${record.level.toUpperCase()}] ${
    record.message
  }${ctxParts ? ` | ${ctxParts}` : ""}`;

  if (record.error) {
    const errParts: string[] = [
      `error.name=${record.error.name}`,
      `error.message=${record.error.message}`,
    ];
    if (record.error.stack) errParts.push(`error.stack=${record.error.stack}`);
    for (const [k, v] of Object.entries(record.error)) {
      if (["name", "message", "stack"].includes(k)) continue;
      errParts.push(`error.${k}=${JSON.stringify(v)}`);
    }
    return `${prefix}\n  ${errParts.join(" ")}`;
  }
  return prefix;
}

function createSink(context: LogContext) {
  return (level: LogLevel, message: string, error?: unknown, extraCtx?: LogContext) => {
    const record: LogRecord = {
      level,
      message,
      timestamp: nowIso(),
      context: { ...context, ...extraCtx },
      ...(error ? { error: serializeError(error) } : {}),
    };
    const stream = level === "error" ? process.stderr : process.stdout;
    stream.write(formatRecord(record) + "\n");
  };
}

/**
 * Creates a structured logger bound to a context. Child loggers inherit and
 * can extend the context (e.g. per-page context inside a document loop).
 */
export function createOcrLogger(initialContext: LogContext = {}): StructuredLogger {
  const sink = createSink(initialContext);

  const base: StructuredLogger = {
    debug: (msg, ctx) => sink("debug", msg, undefined, ctx),
    info: (msg, ctx) => sink("info", msg, undefined, ctx),
    warn: (msg, ctx) => sink("warn", msg, undefined, ctx),
    error: (msg, ctx, err) => sink("error", msg, err, ctx),
    child: (extra) => createOcrLogger({ ...initialContext, ...extra }),
  };

  return base;
}

/** Default module-level logger (no context). Safe to import anywhere. */
export const ocrLogger = createOcrLogger();

/** Convenience: log a thrown/validation error with full context. */
export function logOcrError(
  logger: StructuredLogger,
  message: string,
  error: unknown,
  context: LogContext = {},
): void {
  logger.error(message, { ...context, loggedError: true }, error);
}
