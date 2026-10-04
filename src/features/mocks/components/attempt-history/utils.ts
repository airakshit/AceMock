/** Shared formatting helpers for the attempt history (My History) views. */

/** Formats an attempt date/time, e.g. "03 Oct 2026, 14:05". */
export function formatAttemptDate(value: Date | string): string {
  return new Date(value).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Formats a score without trailing zeros, e.g. 42 → "42", 37.5 → "37.5". */
export function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
