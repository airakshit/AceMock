// Feature-level helpers shared by the questions/bookmarks service layer.

import { ServerActionError } from "../shared/actions/error";
import { isValidUUID } from "../shared/utils";
import type {
  BookmarkCursor,
  ReportedQuestionCursor,
} from "./dto/commands";

/**
 * Encodes a (timestamp, uuid) keyset position into an opaque, URL-safe
 * cursor token. "opaque-string": the internal structure is intentionally
 * hidden from api consumers.
 * Format: base64url("<ISO-8601>_<uuid>") — versioned by structure.
 */
function encodeKeysetCursor(at: Date, id: string): string {
  const raw = `${at.toISOString()}_${id}`;
  return Buffer.from(raw, "utf8").toString("base64url");
}

/**
 * Decodes an opaque cursor token produced by {@link encodeKeysetCursor}.
 * Throws ServerActionError("BAD_REQUEST") for tampered or malformed input.
 */
function decodeKeysetCursor(cursor: string): { at: Date; id: string } {
  const invalid = () =>
    new ServerActionError("BAD_REQUEST", "Invalid pagination cursor.");

  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const separatorIndex = raw.indexOf("_");
    if (separatorIndex <= 0) throw invalid();

    const at = new Date(raw.slice(0, separatorIndex));
    const id = raw.slice(separatorIndex + 1);

    if (Number.isNaN(at.getTime()) || !isValidUUID(id)) {
      throw invalid();
    }

    return { at, id };
  } catch (err) {
    if (err instanceof ServerActionError) throw err;
    throw invalid();
  }
}

/**
 * Encodes a keyset position for the bookmark page (bookmarkedAt, id).
 */
export function encodeBookmarkCursor(cursor: BookmarkCursor): string {
  return encodeKeysetCursor(cursor.bookmarkedAt, cursor.bookmarkId);
}

/**
 * Decodes an opaque cursor token produced by {@link encodeBookmarkCursor}.
 * Throws ServerActionError("BAD_REQUEST") for tampered or malformed input.
 */
export function decodeBookmarkCursor(cursor: string): BookmarkCursor {
  const { at, id } = decodeKeysetCursor(cursor);
  return { bookmarkedAt: at, bookmarkId: id };
}

/**
 * Encodes a keyset position for the admin reports page
 * (latestReportAt, questionId).
 */
export function encodeReportedQuestionCursor(
  cursor: ReportedQuestionCursor,
): string {
  return encodeKeysetCursor(cursor.latestReportAt, cursor.questionId);
}

/**
 * Decodes an opaque cursor token produced by
 * {@link encodeReportedQuestionCursor}. Throws
 * ServerActionError("BAD_REQUEST") for tampered or malformed input.
 */
export function decodeReportedQuestionCursor(
  cursor: string,
): ReportedQuestionCursor {
  const { at, id } = decodeKeysetCursor(cursor);
  return { latestReportAt: at, questionId: id };
}
