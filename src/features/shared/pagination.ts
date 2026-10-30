import { ServerActionError } from "@/features/shared/actions/error";

/**
 * Encodes a keyset position into an opaque, URL-safe cursor token.
 * Format: base64url("<ISO-8601 createdAt>|<mockTestId>")
 */
export function encodeSearchCursor(
  cursor: Record<string, Date | string>,
): string {
  for (const key of Object.keys(cursor)) {
    const value = cursor[key];
    if (value instanceof Date) cursor[key] = value.toISOString();
  }
  const rawStr = JSON.stringify(cursor);
  return Buffer.from(rawStr, "utf8").toString("base64url");
}

/**
 * Decodes an opaque cursor token produced by {@link encodeMockTestCursor}.
 * Throws ServerActionError("BAD_REQUEST") for tampered or malformed input.
 */
export function decodeSearchCursor<T>(
  cursor: string,
  validatorFn: (cursor: unknown) => T,
): T {
  const invalid = () =>
    new ServerActionError("BAD_REQUEST", "Invalid pagination cursor.");

  try {
    const rawStr = Buffer.from(cursor, "base64url").toString("utf8");
    const cursorJson = JSON.parse(rawStr);
    const validatedCursor: T = validatorFn(cursorJson);
    return validatedCursor;
  } catch (error) {
    throw invalid();
  }
}
