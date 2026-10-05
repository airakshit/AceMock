// Client action input commands for mock tests mutations
// Accessed by: client components, server actions, and services

import type { MockTestScope } from "./projections";

export interface CreateMockTestBasePayload {
  name: string;
  documentIds: string[];
  durationMinutes: number;
  negativePercentagePerQuestion: number;
  instructions?: string;
  /** Classification of the test — decides which curriculum ids are stored. */
  scope: MockTestScope;
  /**
   * Leaf curriculum selection for `scope` (subject → subjectId, section →
   * sectionId, chapter → chapterId). Parents are always derived server-side
   * from that entity, so unrelated ids sent by the client are ignored.
   */
  subjectId?: string | null;
  sectionId?: string | null;
  chapterId?: string | null;
  /**
   * When true the attempt shows no countdown and never auto-submits.
   * Defaults to `false` (timed) when omitted.
   */
  allowUntimed?: boolean;
  /**
   * Attempts a student may take; `0` = unlimited. Defaults to 1 when
   * omitted; must be a whole number between 0 and 100.
   */
  maxAttempts?: number;
}

/** Admin creation: the summed question marks may be overridden. */
export interface CreateMockTestFromDocumentsPayload
  extends CreateMockTestBasePayload {
  customTotalMarks?: number;
}

/**
 * Student-authored custom test.
 *
 * Deliberately carries no marks field — `totalMarks` is always inferred in
 * the service layer as the sum of the selected questions' marks.
 */
export type CreateCustomMockTestPayload = CreateMockTestBasePayload;

/**
 * Server-side search over mock tests. Every filter is optional and combined
 * with AND; `cursor` continues a previous result (keyset pagination).
 */
export interface SearchMockTestsPayload {
  scope?: MockTestScope;
  subjectId?: string;
  sectionId?: string;
  chapterId?: string;
  /** Filter by creator type: admin-created vs. user-created tests. */
  byAdmin?: boolean;
  /** Case-insensitive substring match on the test name. */
  search?: string;
  /** Opaque keyset cursor returned as `nextCursor` by a previous call. */
  cursor?: string;
  pageSize?: number;
}

export interface StartMockAttemptPayload {
  mockTestId: string;
}

export interface SubmitAnswerPayload {
  attemptId: string;
  questionId: string;
  selectedOption: "A" | "B" | "C" | "D";
}

export interface CompleteAttemptPayload {
  attemptId: string;
}
