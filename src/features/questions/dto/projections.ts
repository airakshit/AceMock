// Contains the read models returned from the repository. 
// For Db read operations.

// Accessed by: services and repositories

import { QuestionDifficulty, QuestionOption, QuestionOptionKey, QuestionReportType } from "../types";

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

/**
 * One report category rolled up onto a reported question.
 *
 * `count` / `lastReportedAt` / `latestDescription` only ever cover the
 * reports inside the active filter window, so what the admin reads on the
 * card always belongs to the rows they filtered for.
 */
export interface ReportedQuestionTypeProjection {
  reportType: QuestionReportType;
  /** Matching reports of this type on the question. */
  count: number;
  /** Newest matching report of this type — the sort key for the badges. */
  lastReportedAt: Date;
  /**
   * Most recent free-text detail left for this type, if any. Bounded to
   * one string per type so a popular question can never grow the payload
   * without limit.
   */
  latestDescription: string | null;
}

/**
 * Raw row returned by the reported-question page query: one *question*
 * per row with its matching reports rolled up.
 *
 * Answer data (`correctOption`, `solution`) is always selected — the page
 * is admin-only and the whole point is inspecting the reported answer.
 */
export interface ReportedQuestionRow {
  questionId: string;
  /** Newest matching report — also the keyset sort key. */
  latestReportAt: Date;
  /** Matching reports grouped by type, newest type first. */
  reports: ReportedQuestionTypeProjection[];
  /** Matching report rows across every type. */
  reportCount: number;
  /** Distinct reporters across the matching reports. */
  reporterCount: number;
  question: string;
  options: QuestionOption[] | unknown;
  correctOption: string;
  marks: number;
  difficulty: QuestionDifficulty;
  questionDiagram: string | null;
  /** Whether a written solution exists (drives the solution badge). */
  hasSolution: boolean;
  solution: string | null;
  /** Raw storage path — signed by the service before it leaves the server. */
  solutionDiagram: string | null;
  chapterName: string | null;
  sectionName: string | null;
  subjectName: string | null;
  subjectSlug: string | null;
}

/**
 * Read model for one reported question on the admin reports page —
 * {@link ReportedQuestionRow} with storage paths swapped for signed URLs.
 */
export interface ReportedQuestionProjection {
  questionId: string;
  latestReportAt: Date;
  reports: ReportedQuestionTypeProjection[];
  reportCount: number;
  reporterCount: number;
  question: string;
  options: QuestionOption[] | unknown;
  correctOption: QuestionOptionKey;
  marks: number;
  difficulty: QuestionDifficulty;
  /** Signed URL after the service signs storage paths. */
  questionDiagramUrl: string | null;
  hasSolution: boolean;
  solution: string | null;
  /** Signed URL; null when the question has no solution diagram. */
  solutionDiagramUrl: string | null;
  chapterName: string | null;
  sectionName: string | null;
  subjectName: string | null;
  subjectSlug: string | null;
}
