// Contains the input for the repositories. For db operations.
// Accessed by: services and repositories

import {
  QuestionDifficulty,
  QuestionOption,
  QuestionReportType,
} from "../types";


export interface CreateQuestionItemCommand {
  id: string;
  question: string;
  options: QuestionOption[];
  correctOption: string;
  marks: number;
  difficulty: QuestionDifficulty;
  chapterId?: string | null;
  fileId?: string | null;
  passageId?: string | null;
  hint?: string | null;
  solution?: string | null;
  questionDiagram?: string | null; // Diagrams will either be a url or <svg> text
  solutionDiagram?: string | null;
}


/**
 * Command for updating the chapter assignment of a question.
 */
export interface UpdateQuestionChapterCommand {
  questionId: string;
  chapterId: string;
}

/**
 * Item for batch updating question chapter assignments.
 */
export interface UpdateManyQuestionChaptersCommand {
  id: string;
  chapterId: string;
}

/**
 * Command for deleting questions by associated file IDs.
 */
export interface DeleteQuestionsByFileIdsCommand {
  fileIds: string[];
}

/**
 * Command for creating a single passage.
 */
export interface CreatePassageCommand {
  content: string;
}

/**
 * Command for creating multiple passages in bulk.
 */
export interface CreateManyPassagesCommand {
  passageContents: string[];
}

/**
 * Command for inserting a question bookmark row.
 */
export interface CreateQuestionBookmarkItemCommand {
  id: string;
  userId: string;
  questionId: string;
}

/**
 * Command for inserting a question report row.
 */
export interface CreateQuestionReportItemCommand {
  id: string;
  userId: string;
  questionId: string;
  reportType: QuestionReportType;
  description?: string | null;
}

/**
 * Decoded keyset position for bookmark pagination — (bookmarkedAt, id)
 * of the last row on the previous page. Ordering is
 * `createdAt DESC, id DESC`, so the cursor predicate is
 * `(created_at, id) < (cursor.bookmarkedAt, cursor.bookmarkId)`.
 */
export interface BookmarkCursor {
  bookmarkedAt: Date;
  bookmarkId: string;
}

/**
 * Repository query command for one page of a user's bookmarked questions.
 * `includeSolution` controls whether the raw solution columns (correct
 * option, solution, solution diagram) are selected at all — solution
 * loading is never a row filter, so ordering/cursors stay identical.
 */
export interface GetBookmarkedQuestionsQueryCommand {
  userId: string;
  cursor: BookmarkCursor | null;
  subjectSlug?: string;
  includeSolution: boolean;
  limit: number;
}

/**
 * Decoded keyset position for reported-question pagination —
 * (latestReportAt, questionId) of the last row on the previous page.
 *
 * Reports are rolled up to one row per question, ordered by
 * `MAX(created_at) DESC, question_id DESC`. The predicate for that order
 * compares an aggregate, so it belongs in HAVING — the repository keeps
 * it out of WHERE, where a row-level condition could not reference it.
 */
export interface ReportedQuestionCursor {
  latestReportAt: Date;
  questionId: string;
}

/**
 * Repository query command for one admin page of reported questions.
 *
 * Every condition applies to the *report rows* being rolled up: a
 * question appears when at least one of its reports matches, and the
 * cursor sorts on that question's newest matching report — so changing a
 * filter re-derives both the membership and the sort key consistently.
 */
export interface SearchReportedQuestionsQueryCommand {
  /** `null` = every report category. */
  reportType: QuestionReportType | null;
  /** Inclusive start of the report window (UTC). */
  dateFrom: Date | null;
  /** Exclusive end of the report window (UTC). */
  dateTo: Date | null;
  cursor: ReportedQuestionCursor | null;
  limit: number;
}

/**
 * Raw aggregate row behind one entry of the reports summary:
 * how many report rows a type drew, and how many distinct questions
 * those rows point at.
 */
export interface QuestionReportSummaryRow {
  reportType: QuestionReportType;
  reportCount: number;
  questionCount: number;
}
