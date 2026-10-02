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
