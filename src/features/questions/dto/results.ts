// Contains the payload for result of server action or service.

import { SignedUrlResponseObject } from "@/features/shared/storage-service";
import {
  BookmarkedQuestionProjection,
  DocumentWithQuestionCountProjection,
  QuestionDetailsProjection,
} from "./projections";
import { QuestionOptionKey, QuestionReportType } from "../types";

/**
 * Service result for creating a question, returning the generated question ID
 * and signed URLs for any diagram uploads.
 */
export interface CreateQuestionResult {
  questionId: string;
  files: SignedUrlResponseObject[];
}

/**
 * Action / service envelope result for fetching recent questions.
 */
export interface GetRecentQuestionsResult {
  questions: QuestionDetailsProjection[]
}

/**
 * Action / service envelope result for fetching recent documents for filtering.
 */
export interface GetRecentDocumentsResult {
  documents: DocumentWithQuestionCountProjection[]
}

/**
 * Result of bookmarking a question. Idempotent: when the user already
 * had the question bookmarked, `alreadyBookmarked` is true and the
 * existing bookmark is returned.
 */
export interface CreateQuestionBookmarkResult {
  bookmarkId: string;
  questionId: string;
  alreadyBookmarked: boolean;
}

/**
 * Result of removing a bookmark. `removed` is false when the user had
 * no bookmark for the question (idempotent no-op).
 */
export interface RemoveQuestionBookmarkResult {
  questionId: string;
  removed: boolean;
}

/**
 * Result of reporting a question. Idempotent per report category:
 * reporting the same category twice returns the original report with
 * `alreadyReported` set to true.
 */
export interface CreateQuestionReportResult {
  reportId: string;
  questionId: string;
  reportType: QuestionReportType;
  alreadyReported: boolean;
}

/**
 * One cursor-paginated page of bookmarked questions.
 * `nextCursor` is null once the list is exhausted; it must be passed
 * back verbatim to fetch the following page.
 */
export interface GetBookmarkedQuestionsResult {
  questions: BookmarkedQuestionProjection[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Revealed solution for a single bookmarked question — includes the
 * correct option and any written solution / solution diagram.
 */
export interface GetQuestionSolutionResult {
  questionId: string;
  correctOption: QuestionOptionKey;
  solution: string | null;
  /** Signed URL for the solution diagram, when one exists. */
  solutionDiagramUrl: string | null;
}
