import { SignedUrlResponseObject } from "@/features/shared/storage-service";
import { QuestionDifficulty, QuestionOption, QuestionOptionKey } from "../types";
import { questionsService } from "../service";

export interface CreateQuestionFilePayload {
  clientFileId: string;
  name: string;
  size: number;
  type: string;
  field: "diagram" | "solution_diagram";
}

export interface CreateQuestionActionPayload {
  chapterSlug: string;
  question: string;
  options: QuestionOption[];
  correctOption: QuestionOptionKey;
  marks: number;
  difficulty: QuestionDifficulty;
  hint?: string;
  solution?: string;
  files: CreateQuestionFilePayload[];
}

export interface CreateQuestionActionResponse {
  questionId: string;
  files: SignedUrlResponseObject[];
}

/**
 * Derived from the service return type of `getRecentQuestions`.
 * This ensures the DTO always stays in sync with the service layer.
 */
export type QuestionItemDTO = Awaited<
  ReturnType<typeof questionsService.getRecentQuestions>
>[number];

export interface GetRecentQuestionsActionResponse {
  questions: QuestionItemDTO[];
  documentId?: string | null;
  documentTitle?: string | null;
}

export interface DocumentFilterOptionDTO {
  id: string;
  title: string;
  questionCount: number;
  createdAt: string | null;
}

export interface GetRecentDocumentsActionResponse {
  documents: DocumentFilterOptionDTO[];
}