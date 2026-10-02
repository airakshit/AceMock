import { questionBookmarks } from "@/db/schemas";
import { and, eq } from "drizzle-orm";
import { DbExecutor } from "../../shared/types";
import { CreateQuestionBookmarkItemCommand } from "../dto/commands";

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
