import {
  chapters,
  questionBookmarks,
  questions,
  sections,
  subjects,
} from "@/db/schemas";
import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { DbExecutor } from "../../shared/types";
import {
  CreateQuestionBookmarkItemCommand,
  GetBookmarkedQuestionsQueryCommand,
} from "../dto/commands";
import { BookmarkedQuestionRow } from "../dto/projections";

/**
 * Read/write access for the `question_bookmarks` table.
 * All queries are scoped to a (user, question) pair.
 */
export class QuestionBookmarksRepository {
  async findByUserAndQuestion(
    db: DbExecutor,
    userId: string,
    questionId: string,
  ): Promise<typeof questionBookmarks.$inferSelect | null> {
    const [bookmark] = await db
      .select()
      .from(questionBookmarks)
      .where(
        and(
          eq(questionBookmarks.userId, userId),
          eq(questionBookmarks.questionId, questionId),
        ),
      )
      .limit(1);

    return bookmark || null;
  }

  /**
   * One keyset-paginated page of a user's bookmarked questions.
   *
   * Ordering is `(bookmarked_at DESC, bookmark_id DESC)` and the cursor
   * predicate is the equivalent row-value comparison
   * `(created_at, id) < (cursor.createdAt, cursor.id)` expressed as
   * OR/AND — no OFFSET anywhere, so pages stay stable even when rows
   * are inserted or removed between requests.
   *
   * Always returns the same row shape; `includeSolution: false` selects
   * the solution columns as NULL so answer data never leaves the db layer
   * unless the caller asked for it (the service additionally decides
   * whether to project them into the response payload).
   */
  async findBookmarkedQuestions(
    db: DbExecutor,
    query: GetBookmarkedQuestionsQueryCommand,
  ): Promise<BookmarkedQuestionRow[]> {
    const conditions = [eq(questionBookmarks.userId, query.userId)];

    if (query.cursor) {
      const { bookmarkedAt, bookmarkId } = query.cursor;
      conditions.push(
        or(
          lt(questionBookmarks.createdAt, bookmarkedAt),
          and(
            eq(questionBookmarks.createdAt, bookmarkedAt),
            lt(questionBookmarks.id, bookmarkId),
          ),
        )!,
      );
    }

    if (query.subjectSlug) {
      conditions.push(eq(subjects.slug, query.subjectSlug));
    }

    return db
      .select({
        bookmarkId: questionBookmarks.id,
        bookmarkedAt: questionBookmarks.createdAt,
        id: questions.id,
        question: questions.question,
        options: questions.options,
        marks: questions.marks,
        difficulty: questions.difficulty,
        questionDiagram: questions.questionDiagram,
        // Cheap availability flag — always selected so the UI badge works
        // even when the answer columns themselves are not requested.
        hasSolution: sql<boolean>`${questions.solution} IS NOT NULL`,
        // Solution columns only when asked for; otherwise a NULL literal
        // keeps the row shape stable without ever selecting answer data.
        ...(query.includeSolution
          ? {
              correctOption: questions.correctOption,
              solution: questions.solution,
              solutionDiagram: questions.solutionDiagram,
            }
          : {
              correctOption: sql<string | null>`null`,
              solution: sql<string | null>`null`,
              solutionDiagram: sql<string | null>`null`,
            }),
        chapterName: chapters.name,
        sectionName: sections.name,
        subjectName: subjects.name,
        subjectSlug: subjects.slug,
      })
      .from(questionBookmarks)
      .innerJoin(questions, eq(questionBookmarks.questionId, questions.id))
      .leftJoin(chapters, eq(questions.chapterId, chapters.id))
      .leftJoin(sections, eq(chapters.sectionId, sections.id))
      .leftJoin(subjects, eq(sections.subjectId, subjects.id))
      .where(and(...conditions))
      .orderBy(desc(questionBookmarks.createdAt), desc(questionBookmarks.id))
      .limit(query.limit);
  }

  async create(
    db: DbExecutor,
    data: CreateQuestionBookmarkItemCommand,
  ): Promise<typeof questionBookmarks.$inferSelect> {
    const [bookmark] = await db
      .insert(questionBookmarks)
      .values({
        id: data.id,
        userId: data.userId,
        questionId: data.questionId,
      })
      .returning();

    return bookmark;
  }

  async deleteByUserAndQuestion(
    db: DbExecutor,
    userId: string,
    questionId: string,
  ): Promise<boolean> {
    const deleted = await db
      .delete(questionBookmarks)
      .where(
        and(
          eq(questionBookmarks.userId, userId),
          eq(questionBookmarks.questionId, questionId),
        ),
      )
      .returning({ id: questionBookmarks.id });

    return deleted.length > 0;
  }
}

export const questionBookmarksRepository = new QuestionBookmarksRepository();
