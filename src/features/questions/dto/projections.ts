// Contains the read models returned from the repository. 
// For Db read operations.

// Accessed by: services and repositories

import { QuestionDifficulty, QuestionOption } from "../types";

/**
 * Base read model projection representing a row in the `questions` table.
 */
export interface QuestionProjection {
  id: string;
  chapterId: string | null;
  passageId: string | null;
  fileId: string | null;
  question: string;
  options: QuestionOption[] | unknown;
  correctOption: string;
  marks: number;
  difficulty: QuestionDifficulty;
  questionDiagram: string | null;
  hint: string | null;
  solution: string | null;
  solutionDiagram: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Read model projection joining question with its document, file, and curriculum hierarchy.
 * Used by repository read queries such as `findRecentWithCurriculum`.
 */
export interface QuestionDetailsProjection {
  id: string;
  question: string;
  options: QuestionOption[] | unknown;
  correctOption: string;
  marks: number;
  difficulty: QuestionDifficulty;
  questionDiagram: string | null;
  hint: string | null;
  solution: string | null;
  solutionDiagram: string | null;
  createdAt: Date;
  updatedAt: Date;
  chapterId: string | null;
  chapterName: string | null;
  chapterSlug: string | null;
  sectionName: string | null;
  subjectName: string | null;
  subjectSlug: string | null;
  fileId: string | null;
  fileName: string | null;
  documentId: string | null;
  documentTitle: string | null;
}

/**
 * Read model projection for documents with aggregated question count.
 * Used by repository read queries such as `findRecentDocumentsWithQuestions`.
 */
export interface DocumentWithQuestionCountProjection {
  id: string;
  title: string;
  createdAt: Date;
  questionCount: number;
}

/**
 * Read model projection representing chapter and its parent curriculum mappings.
 * Used by `getAllChaptersMap`.
 */
export interface ChapterCurriculumMappingProjection {
  id: string;
  name: string;
  slug: string;
  sectionSlug: string | null;
  subjectSlug: string | null;
}

/**
 * Read model projection for a single chapter record lookup.
 */
export interface ChapterLookupProjection {
  id: string;
  sectionId: string;
  name: string;
  slug: string;
  description: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Read model projection for a passage record.
 */
export interface PassageProjection {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}
