// Database write models consumed by repository insert/update operations,
// plus the keyset (cursor) read model consumed by repository searches
// Accessed by: services and repositories

import type { MockTestScope } from "./projections";

export interface CreateMockTestCommand {
  id: string;
  userId: string;
  name: string;
  totalMarks: number;
  negativePercentagePerQuestion: number;
  durationSeconds: number;
  instructions?: string | null;
  /** Admin panel creations always store `true`. */
  byAdmin: boolean;
  scope: MockTestScope;
  subjectId: string | null;
  sectionId: string | null;
  chapterId: string | null;
  /** Normalized: `true` only when the admin explicitly opted in. */
  allowUntimed: boolean;
  /** Normalized: whole number, `0` = unlimited. */
  maxAttempts: number;
}

/**
 * Keyset position of one mock test inside a search result. Carries every
 * value the ORDER BY uses — `scope` participates whenever the result is
 * hierarchically ordered (parent tests before child tests), so pagination
 * stays deterministic without OFFSET.
 */
export interface MockTestCursor {
  scope: MockTestScope;
  createdAt: Date;
  id: string;
}

/** Normalized, already-validated input of `MockTestsRepository.search`. */
export interface SearchMockTestsQuery {
  scope?: MockTestScope;
  subjectId?: string;
  sectionId?: string;
  chapterId?: string;
  byAdmin?: boolean;
  /**
   * Restrict the result to tests created by this user. Combined with
   * `byAdmin` it scopes the two student views: application tests
   * (`byAdmin: true`) vs. the caller's own tests (`userId` + `byAdmin: false`).
   */
  userId?: string;
  search?: string;
  cursor?: MockTestCursor | null;
  /** Rows to fetch — the service requests `pageSize + 1` to detect the end. */
  limit: number;
}

export interface CreateMockTestQuestionItemCommand {
  id: string;
  mockTestId: string;
  questionId: string;
  position: number;
}

export interface DeleteMockTestCommand {
  id: string;
}

export interface CreateMockAttemptCommand {
  id: string;
  userId: string;
  mockTestId: string;
}

export interface SubmitAttemptAnswerCommand {
  id: string;
  attemptId: string;
  questionId: string;
  selectedOption: "A" | "B" | "C" | "D";
}

export interface CompleteMockAttemptCommand {
  attemptId: string;
}
