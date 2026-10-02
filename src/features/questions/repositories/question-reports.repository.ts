import { questionReports } from "@/db/schemas";
import { and, eq } from "drizzle-orm";
import { DbExecutor } from "../../shared/types";
import { CreateQuestionReportItemCommand } from "../dto/commands";
import { QuestionReportType } from "../types";

/**
 * Read/write access for the `question_reports` table.
 * Lookups are scoped to a (user, question, report type) triple so the
 * same issue cannot be reported twice by the same user.
 */
export class QuestionReportsRepository {
  async findUserReport(
    db: DbExecutor,
    userId: string,
    questionId: string,
    reportType: QuestionReportType,
  ): Promise<typeof questionReports.$inferSelect | null> {
    const [report] = await db
      .select()
      .from(questionReports)
      .where(
        and(
          eq(questionReports.userId, userId),
          eq(questionReports.questionId, questionId),
          eq(questionReports.reportType, reportType),
        ),
      )
      .limit(1);

    return report || null;
  }

  async create(
    db: DbExecutor,
    data: CreateQuestionReportItemCommand,
  ): Promise<typeof questionReports.$inferSelect> {
    const [report] = await db
      .insert(questionReports)
      .values({
        id: data.id,
        userId: data.userId,
        questionId: data.questionId,
        reportType: data.reportType,
        description: data.description ?? null,
      })
      .returning();

    return report;
  }
}

export const questionReportsRepository = new QuestionReportsRepository();
