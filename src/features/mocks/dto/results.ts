// Service return models
// Accessed by: services, server actions, and frontend callers

import { MockTestDetailsProjection, MockTestListItemProjection } from "./projections";
import {
  MockTestAttemptQuestionsProjection,
  MockTestAttemptProjection,
  MockAttemptAnswerProjection,
  AttemptDetailsProjection,
  AttemptHistoryItemProjection,
  AttemptReviewIndexItem,
  ReviewQuestionResult,
} from "./projections";

export interface CreateMockTestResult {
  id: string;
  name: string;
  totalMarks: number;
  totalQuestions: number;
  durationSeconds: number;
  negativePercentagePerQuestion: number;
}

export type MockTestDetailsResult = MockTestDetailsProjection;

export type MockTestListResult = MockTestListItemProjection[];

/**
 * One cursor-paginated page of mock tests.
 * `nextCursor` is null once the list is exhausted and must be passed back
 * verbatim (together with the same filters) to fetch the following page.
 */
export interface MockTestSearchResult {
  items: MockTestListItemProjection[];
  nextCursor: string | null;
  hasNextPage: boolean;
}

export interface DeleteMockTestResult {
  deletedId: string;
  success: boolean;
}

/**
 * Test metadata handed to the exam UI for one attempt. Mirrors
 * `MockTestAttemptMeta` on the client.
 */
export interface AttemptMockTestMeta {
  id: string;
  name: string;
  totalMarks: number;
  totalQuestions: number;
  durationSeconds: number;
  /** Attempts a student may take; 0 = unlimited. */
  maxAttempts: number;
  /** True when the attempt runs without a countdown or auto-submit. */
  allowUntimed: boolean;
  negativePercentagePerQuestion: number;
  instructions: string | null;
}

export interface StartMockAttemptResult {
  attempt: MockTestAttemptProjection;
  questions: MockTestAttemptQuestionsProjection;
  /** Previously saved answers — used to resume an in-progress attempt. */
  answers: MockAttemptAnswerProjection[];
  mockTest: AttemptMockTestMeta;
}

export interface SubmitAnswerResult {
  answer: MockAttemptAnswerProjection;
}

export interface GetAttemptQuestionsResult {
  questions: MockTestAttemptQuestionsProjection;
  attempt: MockTestAttemptProjection;
}

export interface GetAttemptResult {
  attempt: MockTestAttemptProjection;
  mockTest: AttemptMockTestMeta;
}

/** Scored summary of every attempt made by the current user. */
export type AttemptHistoryResult = AttemptHistoryItemProjection[];

/** Full per-question breakdown of one completed attempt. */
export type AttemptDetailsResult = AttemptDetailsProjection;

/** Review: one question with full answer comparison and marks. */
export type ReviewQuestionResultProjection = ReviewQuestionResult;

/** Review: summary of a completed attempt with status index. */
export interface AttemptReviewSummaryResult {
  attempt: {
    id: string;
    mockTestId: string;
    status: "in_progress" | "completed";
    startedAt: Date;
    submittedAt: Date | null;
  };
  mockTest: {
    id: string;
    name: string;
    totalMarks: number;
    totalQuestions: number;
    durationSeconds: number;
    negativePercentagePerQuestion: number;
  };
  scoreMarks: number;
  accuracyPercent: number;
  attemptedCount: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  /** Minimal index for the navigator: position + status per question. */
  index: AttemptReviewIndexItem[];
}

export type { ReviewQuestionResult } from "./projections";
