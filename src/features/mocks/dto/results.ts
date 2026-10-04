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

export interface DeleteMockTestResult {
  deletedId: string;
  success: boolean;
}

export interface StartMockAttemptResult {
  attempt: MockTestAttemptProjection;
  questions: MockTestAttemptQuestionsProjection;
  /** Previously saved answers — used to resume an in-progress attempt. */
  answers: MockAttemptAnswerProjection[];
  mockTest: {
    id: string;
    name: string;
    totalMarks: number;
    totalQuestions: number;
    durationSeconds: number;
    negativePercentagePerQuestion: number;
    instructions: string | null;
  };
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
  mockTest: {
    id: string;
    name: string;
    totalMarks: number;
    totalQuestions: number;
    durationSeconds: number;
    negativePercentagePerQuestion: number;
    instructions: string | null;
  };
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
