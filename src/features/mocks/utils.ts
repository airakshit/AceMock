// Feature-level helpers shared by the mocks service and server actions.

import { ServerActionError } from "@/features/shared/actions/error";
import { isValidUUID } from "@/features/shared/utils";
import type { MockTestCursor } from "./dto/commands";
import type { MockTestScope } from "./dto/projections";

/** Every value of the `mock_test_scope` enum, in hierarchy order. */
export const MOCK_TEST_SCOPES: readonly MockTestScope[] = [
  "ioe_model",
  "subject",
  "section",
  "chapter",
  "miscellaneous",
];

/** Runtime guard for untrusted scope input coming from a client payload. */
export function isMockTestScope(value: unknown): value is MockTestScope {
  return (
    typeof value === "string" &&
    (MOCK_TEST_SCOPES as readonly string[]).includes(value)
  );
}

const SEPARATOR = "|";

/**
 * Encodes a keyset position into an opaque, URL-safe cursor token.
 * Format: base64url("<scope>|<ISO-8601 createdAt>|<mockTestId>") — the scope
 * is part of the key because hierarchically ordered results sort parents
 * before children, then by `created_at DESC, id DESC`.
 */
export function encodeMockTestCursor(cursor: MockTestCursor): string {
  const raw = [cursor.scope, cursor.createdAt.toISOString(), cursor.id].join(
    SEPARATOR,
  );
  return Buffer.from(raw, "utf8").toString("base64url");
}

/**
 * Decodes an opaque cursor token produced by {@link encodeMockTestCursor}.
 * Throws ServerActionError("BAD_REQUEST") for tampered or malformed input.
 */
export function decodeMockTestCursor(cursor: string): MockTestCursor {
  const invalid = () =>
    new ServerActionError("BAD_REQUEST", "Invalid pagination cursor.");

  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const parts = raw.split(SEPARATOR);
    if (parts.length !== 3) throw invalid();

    const [scope, createdAt, id] = parts;
    const parsedCreatedAt = new Date(createdAt);

    if (
      !isMockTestScope(scope) ||
      Number.isNaN(parsedCreatedAt.getTime()) ||
      !isValidUUID(id)
    ) {
      throw invalid();
    }

    return { scope, createdAt: parsedCreatedAt, id };
  } catch (err) {
    if (err instanceof ServerActionError) throw err;
    throw invalid();
  }
}
