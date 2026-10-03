// Feature-level helpers shared by the questions/bookmarks service layer.

import { ServerActionError } from "../shared/actions/error";
import { isValidUUID } from "../shared/utils";
import type { BookmarkCursor } from "./dto/commands";

/**
 * Encodes a keyset position into an opaque, URL-safe cursor token.
 * opaque-string: means internal structure is intentionally hidden for api consumers.
 * Format: base64url("<ISO-8601>_<bookmarkId>") — versioned by structure
 */
export function encodeBookmarkCursor(cursor: BookmarkCursor): string {
  const raw = `${cursor.bookmarkedAt.toISOString()}_${cursor.bookmarkId}`;
  return Buffer.from(raw, "utf8").toString("base64url");
}

/**
 * Decodes an opaque cursor token produced by {@link encodeBookmarkCursor}.
 * Throws ServerActionError("BAD_REQUEST") for tampered or malformed input.
 */
export function decodeBookmarkCursor(cursor: string): BookmarkCursor {
  const invalid = () =>
    new ServerActionError("BAD_REQUEST", "Invalid pagination cursor.");

  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const separatorIndex = raw.indexOf("_");
    if (separatorIndex <= 0) throw invalid();

    const bookmarkedAt = new Date(raw.slice(0, separatorIndex));
    const bookmarkId = raw.slice(separatorIndex + 1);

    if (Number.isNaN(bookmarkedAt.getTime()) || !isValidUUID(bookmarkId)) {
      throw invalid();
    }

    return { bookmarkedAt, bookmarkId };
  } catch (err) {
    if (err instanceof ServerActionError) throw err;
    throw invalid();
  }
}
