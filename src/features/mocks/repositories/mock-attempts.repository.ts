import { mockTests, mockTestsAttempts, mockAttemptAnswers } from "@/db/schemas";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { DbExecutor } from "@/features/shared/types";
import {
  CreateMockAttemptCommand,
  SubmitAttemptAnswerCommand,
  CompleteMockAttemptCommand
} from "../dto/commands";
import {
  MockTestAttemptProjection,
  MockAttemptAnswerProjection,
  AttemptMetaProjection,
  AttemptAnswerRowProjection
} from "../dto/projections";



export class MockTestAttemptsRepository {
  /**
   * Creates a new mock test attempt for a user.
   */
  async createAttempt(
    db: DbExecutor,
    data: CreateMockAttemptCommand,
  ): Promise<typeof mockTestsAttempts.$inferSelect> {
    const [record] = await db
      .insert(mockTestsAttempts)
      .values({
        id: data.id,
        userId: data.userId,
        mockTestId: data.mockTestId,
        status: "in_progress",
      })
      .returning();

    return record;
  }

  /**
   * Fetches an attempt by ID with its mock test metadata.
   */
  async findAttemptById(
    db: DbExecutor,
    attemptId: string,
  ): Promise<MockTestAttemptProjection | null> {
    const [record] = await db
      .select({
        id: mockTestsAttempts.id,
        userId: mockTestsAttempts.userId,
        mockTestId: mockTestsAttempts.mockTestId,
        status: mockTestsAttempts.status,
        submittedAt: mockTestsAttempts.submittedAt,
        createdAt: mockTestsAttempts.createdAt,
        updatedAt: mockTestsAttempts.updatedAt,
      })
      .from(mockTestsAttempts)
      .where(eq(mockTestsAttempts.id, attemptId))
      .limit(1);

    if (!record) return null;

    return {
      id: record.id,
      mockTestId: record.mockTestId,
      userId: record.userId,
      status: record.status,
      submittedAt: record.submittedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /**
   * Submits or updates an answer for a question in an attempt.
   * Relies on the unique constraint on (attempt_id, question_id):
   * a repeated submission overwrites the previous answer in place.
   */
  async upsertAttemptAnswer(
    db: DbExecutor,
    data: SubmitAttemptAnswerCommand,
  ): Promise<typeof mockAttemptAnswers.$inferSelect> {
    const [record] = await db
      .insert(mockAttemptAnswers)
      .values({
        id: data.id,
        attemptId: data.attemptId,
        questionId: data.questionId,
        selectedOption: data.selectedOption,
      })
      .onConflictDoUpdate({
        target: [mockAttemptAnswers.attemptId, mockAttemptAnswers.questionId],
        set: {
          selectedOption: data.selectedOption,
          updatedAt: new Date(),
        },
      })
      .returning();

    return record;
  }

  /**
   * Gets all answers for an attempt.
   */
  async findAttemptAnswers(
    db: DbExecutor,
    attemptId: string,
  ): Promise<MockAttemptAnswerProjection[]> {
    const records = await db
      .select({
        id: mockAttemptAnswers.id,
        attemptId: mockAttemptAnswers.attemptId,
        questionId: mockAttemptAnswers.questionId,
        selectedOption: mockAttemptAnswers.selectedOption,
        createdAt: mockAttemptAnswers.createdAt,
        updatedAt: mockAttemptAnswers.updatedAt,
      })
      .from(mockAttemptAnswers)
      .where(eq(mockAttemptAnswers.attemptId, attemptId));

    return records.map((r) => ({
      id: r.id,
      attemptId: r.attemptId,
      questionId: r.questionId,
      selectedOption: r.selectedOption as "A" | "B" | "C" | "D",
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  /**
   * All attempts created by a user (newest first) joined with their mock
   * test configuration — the basis of the My History list. When `mockTestId`
   * is given, only that test's attempts are returned (per-card history pop-up).
   */
  async findUserAttempts(
    db: DbExecutor,
    userId: string,
    mockTestId?: string,
  ): Promise<AttemptMetaProjection[]> {
    const records = await db
      .select({
        id: mockTestsAttempts.id,
        mockTestId: mockTestsAttempts.mockTestId,
        mockTestName: mockTests.name,
        status: mockTestsAttempts.status,
        startedAt: mockTestsAttempts.createdAt,
        submittedAt: mockTestsAttempts.submittedAt,
        durationSeconds: mockTests.durationSeconds,
        totalMarks: mockTests.totalMarks,
        negativePercentagePerQuestion: mockTests.negativePercentagePerQuestion,
      })
      .from(mockTestsAttempts)
      .innerJoin(mockTests, eq(mockTestsAttempts.mockTestId, mockTests.id))
      .where(
        mockTestId
          ? and(
              eq(mockTestsAttempts.userId, userId),
              eq(mockTestsAttempts.mockTestId, mockTestId),
            )
          : eq(mockTestsAttempts.userId, userId),
      )
      .orderBy(desc(mockTestsAttempts.createdAt));

    return records;
  }

  /**
   * Batch fetch: answers for several attempts at once (scoring the history
   * list would otherwise issue one query per attempt).
   */
  async findAnswersForAttempts(
    db: DbExecutor,
    attemptIds: string[],
  ): Promise<AttemptAnswerRowProjection[]> {
    if (attemptIds.length === 0) return [];

    const records = await db
      .select({
        attemptId: mockAttemptAnswers.attemptId,
        questionId: mockAttemptAnswers.questionId,
        selectedOption: mockAttemptAnswers.selectedOption,
      })
      .from(mockAttemptAnswers)
      .where(inArray(mockAttemptAnswers.attemptId, attemptIds));

    return records.map((r) => ({
      attemptId: r.attemptId,
      questionId: r.questionId,
      selectedOption: r.selectedOption,
    }));
  }

  /**
   * Marks an attempt as completed.
   */
  async completeAttempt(
    db: DbExecutor,
    data: CompleteMockAttemptCommand,
  ): Promise<void> {
    await db
      .update(mockTestsAttempts)
      .set({
        status: "completed",
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(mockTestsAttempts.id, data.attemptId));
  }

  /**
   * Checks if a user has an in-progress attempt for a mock test.
   */
  async findInProgressAttempt(
    db: DbExecutor,
    userId: string,
    mockTestId: string,
  ): Promise<MockTestAttemptProjection | null> {
    const [record] = await db
      .select({
        id: mockTestsAttempts.id,
        userId: mockTestsAttempts.userId,
        mockTestId: mockTestsAttempts.mockTestId,
        status: mockTestsAttempts.status,
        submittedAt: mockTestsAttempts.submittedAt,
        createdAt: mockTestsAttempts.createdAt,
        updatedAt: mockTestsAttempts.updatedAt,
      })
      .from(mockTestsAttempts)
      .where(
        and(
          eq(mockTestsAttempts.userId, userId),
          eq(mockTestsAttempts.mockTestId, mockTestId),
          eq(mockTestsAttempts.status, "in_progress"),
        ),
      )
      .limit(1);

    if (!record) return null;

    return {
      id: record.id,
      mockTestId: record.mockTestId,
      userId: record.userId,
      status: record.status,
      submittedAt: record.submittedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /**
   * How many attempts (any status) a user has taken for a mock test —
   * the basis of the `maxAttempts` limit enforced on start.
   */
  async countUserAttempts(
    db: DbExecutor,
    userId: string,
    mockTestId: string,
  ): Promise<number> {
    const [row] = await db
      .select({ value: count(mockTestsAttempts.id) })
      .from(mockTestsAttempts)
      .where(
        and(
          eq(mockTestsAttempts.userId, userId),
          eq(mockTestsAttempts.mockTestId, mockTestId),
        ),
      );

    return Number(row?.value ?? 0);
  }
}

export const mockTestAttemptRepository = new MockTestAttemptsRepository();
