import { QuestionDifficulty } from "../types";
export type { QuestionFormData, QuestionImageFile } from "../schemas";
export type {
  QuestionCardType,
  QuestionCardProps,
  QuestionSubject,
  QuestionMode,
  OptionKey,
  OptionType,
} from "./question-card/types";

/**
 * Frontend file wrapper for client-side uploads (e.g. diagrams, solutions).
 */
export interface QuestionFileItem {
  clientFileId: string;
  file: File;
}

/**
 * Filter state managed by the questions list/test views.
 */
export interface QuestionFilterState {
  documentId?: string;
  subjectSlug?: string;
  chapterSlug?: string;
  difficulty?: QuestionDifficulty | "all";
  searchQuery?: string;
}

/**
 * Selection state for the cascading CurriculumSelector.
 */
export interface CurriculumSelection {
  subjectSlug: string;
  sectionSlug: string;
  chapterSlug: string;
}
