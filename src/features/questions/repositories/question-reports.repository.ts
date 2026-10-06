import {
  chapters,
  questionReports,
  questions,
  sections,
  subjects,
} from "@/db/schemas";
import {
  SQL,
  and,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  inArray,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { DbExecutor } from "../../shared/types";
import {
  CreateQuestionReportItemCommand,
  QuestionReportSummaryRow,
  SearchReportedQuestionsQueryCommand,
} from "../dto/commands";
import { ReportedQuestionRow } from "../dto/projections";
import { QuestionReportType } from "../../shared/components/question-card/types";

/** Row-level conditions shared by every report-scoped query. */
interface ReportFilter {
  reportType: QuestionReportType | null;
  /** Inclusive lower bound on report time. */
  dateFrom: Date | null;
  /** Exclusive upper bound on report time. */
  dateTo: Date | null;
}

function buildReportConditions(filter: ReportFilter): SQL[] {
  const conditions: SQL[] = [];

  if (filter.reportType) {
    conditions.push(eq(questionReports.reportType, filter.reportType));
  }
  if (filter.dateFrom) {
    conditions.push(gte(questionReports.createdAt, filter.dateFrom));
  }
  if (filter.dateTo) {
    conditions.push(lt(questionReports.createdAt, filter.dateTo));
  }

  return conditions;
}

/**
 * Read/write access for the `question_reports` table.
 * Lookups are scoped to a (user, question, report type) triple so the
 * same issue cannot be reported twice by the same user.
 *
 * The admin reads roll reports up to one row per question: membership,
 * ordering, and pagination all operate on `(MAX(created_at), question_id)`
 * so a question whose reports straddle a page boundary can never be split
 * across two pages.
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

  /**
   * One page of reported questions, newest reported question first.
   *
   * Two queries, deliberately:
   *
   * 1. **Page of questions** — `GROUP BY question_id` over the *filtered*
   *    report rows, ordered by `MAX(created_at) DESC, question_id DESC`.
   *    The keyset predicate compares `MAX(created_at)`, so it lives in
   *    HAVING: it is an aggregate, not a row condition. Limiting here means
   *    a page is a set of questions, never a set of report rows that a
   *    popular question could split across pages.
   * 2. **Detail rows** — the card payload plus the matching reports for
   *    exactly those question ids, joined onto the curriculum hierarchy.
   *
   * Both use {@link buildReportConditions}, so a question rolled up in
   * step 1 always has rows in step 2.
   *
   * Never uses OFFSET — pages stay stable while reports keep arriving.
   */
  async searchReportedQuestions(
    db: DbExecutor,
    query: SearchReportedQuestionsQueryCommand,
  ): Promise<ReportedQuestionRow[]> {
    const conditions = buildReportConditions(query);
    const latestReportAt = sql<Date>`max(${questionReports.createdAt})`;

    // ─── 1. Which questions are on this page ───────────────────────
    const page = await db
      .select({
        questionId: questionReports.questionId,
        latestReportAt,
      })
      .from(questionReports)
      .where(and(...conditions))
      .groupBy(questionReports.questionId)
      .having(
        query.cursor
          ? or(
              lt(latestReportAt, query.cursor.latestReportAt),
              and(
                eq(latestReportAt, query.cursor.latestReportAt),
                lt(questionReports.questionId, query.cursor.questionId),
              ),
            )!
          : undefined,
      )
      .orderBy(desc(latestReportAt), desc(questionReports.questionId))
      .limit(query.limit);

    if (page.length === 0) return [];

    // ─── 2. Everything the card renders, for just those questions ──
    const pageIds = page.map((row) => row.questionId);

    const detailRows = await db
      .select({
        questionId: questionReports.questionId,
        reportType: questionReports.reportType,
        reportCreatedAt: questionReports.createdAt,
        reportDescription: questionReports.description,
        reportUserId: questionReports.userId,
        question: questions.question,
        options: questions.options,
        correctOption: questions.correctOption,
        marks: questions.marks,
        difficulty: questions.difficulty,
        questionDiagram: questions.questionDiagram,
        // Cheap availability flag — always selected so the UI badge works
        // even when there is no solution to reveal.
        hasSolution: sql<boolean>`${questions.solution} IS NOT NULL`,
        solution: questions.solution,
        solutionDiagram: questions.solutionDiagram,
        chapterName: chapters.name,
        sectionName: sections.name,
        subjectName: subjects.name,
        subjectSlug: subjects.slug,
      })
      .from(questionReports)
      .innerJoin(questions, eq(questionReports.questionId, questions.id))
      .leftJoin(chapters, eq(questions.chapterId, chapters.id))
      .leftJoin(sections, eq(chapters.sectionId, sections.id))
      .leftJoin(subjects, eq(sections.subjectId, subjects.id))
      .where(
        and(
          inArray(questionReports.questionId, pageIds),
          ...conditions,
        ),
      )
      // Newest report first, so the first row seen per question carries the
      // newest free-text detail.
      .orderBy(desc(questionReports.createdAt), desc(questionReports.id));

    // ─── 3. Roll the report rows up onto their question ────────────
    const byQuestion = new Map<string, typeof detailRows>();
    for (const row of detailRows) {
      const bucket = byQuestion.get(row.questionId);
      if (bucket) bucket.push(row);
      else byQuestion.set(row.questionId, [row]);
    }

    const rolled: ReportedQuestionRow[] = [];

    for (const pageRow of page) {
      // Unreachable by construction: both queries share `conditions`, so
      // any question with a matching page row has matching detail rows.
      const rows = byQuestion.get(pageRow.questionId);
      const first = rows?.[0];
      if (!rows || !first) continue;

      const reporters = new Set<string>();
      const types = new Map<
        QuestionReportType,
        {
          count: number;
          lastReportedAt: Date;
          latestDescription: string | null;
        }
      >();

      for (const row of rows) {
        reporters.add(row.reportUserId);

        const existing = types.get(row.reportType);
        if (existing) {
          existing.count += 1;
          if (row.reportCreatedAt > existing.lastReportedAt) {
            existing.lastReportedAt = row.reportCreatedAt;
          }
          // Detail rows arrive newest-first, so the first non-empty one
          // wins — one bounded string per type, never an unbounded list.
          if (existing.latestDescription === null && row.reportDescription) {
            existing.latestDescription = row.reportDescription;
          }
          continue;
        }

        types.set(row.reportType, {
          count: 1,
          lastReportedAt: row.reportCreatedAt,
          latestDescription: row.reportDescription || null,
        });
      }

      const reports = Array.from(types, ([reportType, bucket]) => ({
        reportType,
        count: bucket.count,
        lastReportedAt: bucket.lastReportedAt,
        latestDescription: bucket.latestDescription,
      })).sort((a, b) => {
        // Newest category first; the enum value breaks ties so badge order
        // never reshuffles between renders.
        const byTime =
          b.lastReportedAt.getTime() - a.lastReportedAt.getTime();
        return byTime !== 0 ? byTime : a.reportType.localeCompare(b.reportType);
      });

      rolled.push({
        questionId: pageRow.questionId,
        latestReportAt: pageRow.latestReportAt,
        reports,
        reportCount: rows.length,
        reporterCount: reporters.size,
        question: first.question,
        options: first.options,
        correctOption: first.correctOption,
        marks: first.marks,
        difficulty: first.difficulty,
        questionDiagram: first.questionDiagram,
        hasSolution: first.hasSolution,
        solution: first.solution,
        solutionDiagram: first.solutionDiagram,
        chapterName: first.chapterName,
        sectionName: first.sectionName,
        subjectName: first.subjectName,
        subjectSlug: first.subjectSlug,
      });
    }

    return rolled;
  }

  /**
   * Global rollup behind the reports page header — no filters, all time.
   *
   * Runs two aggregates because distinct-question totals cannot be summed
   * across types (one question is frequently reported under several), so
   * the grand total needs its own pass over the table.
   */
  async summarizeReports(db: DbExecutor): Promise<{
    totals: { reportCount: number; questionCount: number };
    byType: QuestionReportSummaryRow[];
  }> {
    // Sequential on purpose: `db` may be a transaction, and two queries in
    // flight on one connection is a hazard the executor does not promise to
    // serialize for us.
    const totals = await db
      .select({
        reportCount: count(),
        questionCount: countDistinct(questionReports.questionId),
      })
      .from(questionReports);

    const byType = await db
      .select({
        reportType: questionReports.reportType,
        reportCount: count(),
        questionCount: countDistinct(questionReports.questionId),
      })
      .from(questionReports)
      .groupBy(questionReports.reportType);

    return {
      totals: totals[0] ?? { reportCount: 0, questionCount: 0 },
      byType,
    };
  }
}

export const questionReportsRepository = new QuestionReportsRepository();
