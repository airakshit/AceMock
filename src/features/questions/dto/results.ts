// Contains the payload for result of server action or service.

import { SignedUrlResponseObject } from "@/features/shared/storage-service";
import { DocumentWithQuestionCountProjection, QuestionDetailsProjection } from "./projections";

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
