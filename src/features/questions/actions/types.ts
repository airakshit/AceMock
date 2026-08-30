import { SignedUrlResponseObject } from "@/features/shared/storage-service";
import { QuestionDifficulty, QuestionOption, QuestionOptionKey } from "../types";

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
