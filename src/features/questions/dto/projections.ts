// Contains the read models returned from the repository. 
// For Db read operations.

// Accessed by: services and repositories

import { QuestionDifficulty, QuestionOption, QuestionOptionKey } from "../types";

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
 * Read model of the whole curriculum as flat lists that carry their parent
 * id — the data source of cascading subject → section → chapter pickers.
 */
export interface CurriculumOptionsProjection {
  subjects: Array<{ id: string; name: string }>;
  sections: Array<{ id: string; subjectId: string; name: string }>;
  chapters: Array<{ id: string; sectionId: string; name: string }>;
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

/**
 * Read model projection for one bookmarked question (cursor-paginated
 * bookmarks page).
 *
 * `correctOption` / `solution` / `solutionDiagramUrl` are only populated
 * when the page is explicitly requested with `includeSolution: true`;
 * by default the list carries questions and options only.
 */
export interface BookmarkedQuestionProjection {
  /** Bookmark row id — also the keyset tie-breaker for pagination. */
  bookmarkId: string;
  /** When the question was bookmarked — the keyset sort key. */
  bookmarkedAt: Date;
  id: string;
  question: string;
  options: QuestionOption[] | unknown;
  marks: number;
  difficulty: QuestionDifficulty;
  /** Signed URL after the service signs storage paths. */
  questionDiagram: string | null;
  /** Whether a written solution exists (drives the solution badge). */
  hasSolution: boolean;
  chapterName: string | null;
  sectionName: string | null;
  subjectName: string | null;
  subjectSlug: string | null;
  /** Present only when solutions were loaded with this page. */
  correctOption?: QuestionOptionKey;
  /** Present only when solutions were loaded with this page. */
  solution?: string | null;
  /** Signed URL; present only when solutions were loaded with this page. */
  solutionDiagramUrl?: string | null;
}

/**
 * Raw db row returned by `findBookmarkedQuestions`. Carries the solution
 * columns for the service to conditionally project — never serialized to
 * clients directly. When the query ran with `includeSolution: false`
 * those columns are selected as NULL, so they must be read as nullable.
 */
export interface BookmarkedQuestionRow {
  bookmarkId: string;
  bookmarkedAt: Date;
  id: string;
  question: string;
  options: QuestionOption[] | unknown;
  marks: number;
  difficulty: QuestionDifficulty;
  questionDiagram: string | null;
  /** Whether a written solution exists — always real, never a NULL fill. */
  hasSolution: boolean;
  /** char(1) A-D when `includeSolution` was true, otherwise NULL. */
  correctOption: string | null;
  /** NULL when no solution exists — or when `includeSolution` was false. */
  solution: string | null;
  /** Raw storage path (NULL when absent / not included); signed by the service. */
  solutionDiagram: string | null;
  chapterName: string | null;
  sectionName: string | null;
  subjectName: string | null;
  subjectSlug: string | null;
}
