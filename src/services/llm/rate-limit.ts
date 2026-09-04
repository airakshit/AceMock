/**
 * Parses Groq / OpenAI duration strings into milliseconds.
 *
 * Examples:
 * - "15s" -> 15,000 ms
 * - "1m26.4s" -> 86,400 ms
 * - "2m" -> 120,000 ms
 * - "500ms" -> 500 ms
 * - "15" -> 15,000 ms
 * - Standard HTTP date strings -> difference from now
 */
export function parseResetDurationToMs(
  durationStr: string | null | undefined,
): number | null {
  if (!durationStr) return null;
  const trimmed = durationStr.trim();

  // Pure numeric seconds (e.g. "15" or "15.5")
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Math.ceil(parseFloat(trimmed) * 1000);
  }

  // Composite format like "1m26.4s", "15s", "2m", "500ms", "1h"
  const regex = /(\d+(?:\.\d+)?)\s*(h|m|s|ms)/gi;
  let totalMs = 0;
  let matched = false;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(trimmed)) !== null) {
    matched = true;
    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();

    if (unit === "h") totalMs += value * 3600 * 1000;
    else if (unit === "m") totalMs += value * 60 * 1000;
    else if (unit === "s") totalMs += value * 1000;
    else if (unit === "ms") totalMs += value;
  }

  if (matched && totalMs > 0) {
    return Math.ceil(totalMs);
  }

  // Fallback: Date string (e.g. from standard HTTP Retry-After)
  const parsedDate = Date.parse(trimmed);
  if (!isNaN(parsedDate)) {
    const diff = parsedDate - Date.now();
    return diff > 0 ? Math.ceil(diff) : 1000;
  }

  return null;
}

/**
 * Safely extracts a header from various header representations
 * (Fetch Headers instance, Axios/Node Record<string, string>, etc.)
 */
export function getHeaderValue(headers: unknown, name: string): string | null {
  if (!headers) return null;

  if (typeof (headers as Headers).get === "function") {
    return (
      (headers as Headers).get(name) ||
      (headers as Headers).get(name.toLowerCase()) ||
      null
    );
  }

  if (typeof headers === "object") {
    const record = headers as Record<string, unknown>;
    const val = record[name] ?? record[name.toLowerCase()];
    return typeof val === "string" ? val : null;
  }

  return null;
}

/**
 * Inspects a Groq / OpenAI error and extracts the recommended retry delay in milliseconds.
 * Returns null if the error is not a 429 rate limit error.
 */
export function getGroqRateLimitDelayMs(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;

  const err = error as {
    status?: number;
    code?: string;
    type?: string;
    headers?: unknown;
    error?: {
      code?: string;
      type?: string;
      message?: string;
    };
    message?: string;
  };

  const isRateLimit =
    err.status === 429 ||
    err.code === "rate_limit_exceeded" ||
    err.error?.code === "rate_limit_exceeded" ||
    (typeof err.message === "string" &&
      (err.message.includes("rate_limit_exceeded") ||
        err.message.includes("Rate limit reached") ||
        err.message.includes("enforced limit")));

  if (!isRateLimit) return null;

  const headers = err.headers;

  const resetTokens = getHeaderValue(headers, "x-ratelimit-reset-tokens");
  const resetRequests = getHeaderValue(headers, "x-ratelimit-reset-requests");
  const retryAfter = getHeaderValue(headers, "retry-after");

  const errorType = err.error?.type || err.type;
  let candidateHeader: string | null = null;

  if (errorType === "tokens" && resetTokens) {
    candidateHeader = resetTokens;
  } else if (errorType === "requests" && resetRequests) {
    candidateHeader = resetRequests;
  } else {
    // Prefer resetTokens, then retryAfter, then resetRequests
    candidateHeader = resetTokens || retryAfter || resetRequests;
  }

  const parsedMs = parseResetDurationToMs(candidateHeader);

  if (parsedMs !== null) {
    // Add a 1.5s safety buffer so the retry happens cleanly after the window resets
    return Math.max(parsedMs + 1500, 2000);
  }

  // Default fallback if headers were missing: 15 seconds
  return 15000;
}
