import {
  documentFiles,
  documents,
  mockTests,
  mockTestsQuestions,
  mockTestsAttempts,
  mockAttemptAnswers,
  questions,
  passages,
  user,
} from "@/db/schemas";
import { asc, count, desc, eq, ilike, inArray, and } from "drizzle-orm";
import { DbExecutor } from "@/features/shared/types";
import {
  CreateMockTestCommand,
  CreateMockTestQuestionItemCommand,
  CreateMockAttemptCommand,
  SubmitAttemptAnswerCommand,
  CompleteMockAttemptCommand,
} from "../dto/commands";
import {
  DocumentOptionForMockProjection,
  MockTestDetailsProjection,
  MockTestListItemProjection,
  MockTestQuestionItemProjection,
  MockTestAttemptQuestionsProjection,
  MockAttemptQuestionProjection,
  MockAttemptPassageProjection,
  MockTestAttemptProjection,
  MockAttemptAnswerProjection,
  AttemptMetaProjection,
  AttemptAnswerRowProjection,
  AttemptQuestionRowProjection,
  ReviewQuestionResult,
  AttemptReviewIndexItem,
} from "../dto/projections";

export class MockTestsRepository {
  /**
   * Retrieves all documents with their question counts to let admins pick from them.
   */
  async findDocumentsWithQuestionsCount(
    db: DbExecutor,
  ): Promise<DocumentOptionForMockProjection[]> {
    const records = await db
      .select({
        id: documents.id,
        title: documents.title,
        createdAt: documents.createdAt,
        questionCount: count(questions.id),
      })
      .from(documents)
      .leftJoin(documentFiles, eq(documentFiles.documentId, documents.id))
      .leftJoin(questions, eq(questions.fileId, documentFiles.id))
      .groupBy(documents.id, documents.title, documents.createdAt)
      .orderBy(desc(documents.createdAt));

    return records.map((r) => ({
      id: r.id,
      title: r.title,
      createdAt: r.createdAt,
      questionCount: Number(r.questionCount || 0),
    }));
  }

  /**
   * Finds all questions associated with document files belonging to the given document IDs.
   */
  async findQuestionsByDocumentIds(
    db: DbExecutor,
    documentIds: string[],
  ): Promise<
    Array<{
      id: string;
      marks: number;
      question: string;
      difficulty: "easy" | "medium" | "hard";
      documentId: string;
      documentTitle: string;
    }>
  > {
    if (documentIds.length === 0) return [];

    const records = await db
      .select({
        id: questions.id,
        marks: questions.marks,
        question: questions.question,
        difficulty: questions.difficulty,
        documentId: documentFiles.documentId,
        documentTitle: documents.title,
      })
      .from(questions)
      .innerJoin(documentFiles, eq(questions.fileId, documentFiles.id))
      .innerJoin(documents, eq(documentFiles.documentId, documents.id))
      .where(inArray(documentFiles.documentId, documentIds))
      .orderBy(asc(documentFiles.documentId), asc(questions.createdAt));

    return records.map((r) => ({
      id: r.id,
      marks: r.marks,
      question: r.question,
      difficulty: r.difficulty,
      documentId: r.documentId,
      documentTitle: r.documentTitle,
    }));
  }

  /**
   * Inserts the parent mock test record.
   */
  async create(
    db: DbExecutor,
    data: CreateMockTestCommand,
  ): Promise<typeof mockTests.$inferSelect> {
    const [record] = await db
      .insert(mockTests)
      .values({
        id: data.id,
        userId: data.userId,
        name: data.name,
        totalMarks: data.totalMarks,
        negativePercentagePerQuestion: data.negativePercentagePerQuestion,
        duration_seconds: data.durationSeconds,
        instructions: data.instructions ?? null,
      })
      .returning();

    return record;
  }

  /**
   * Batch inserts question links into mock-tests-questions.
   */
  async createMockTestQuestions(
    db: DbExecutor,
    items: CreateMockTestQuestionItemCommand[],
  ): Promise<void> {
    if (items.length === 0) return;

    await db.insert(mockTestsQuestions).values(
      items.map((item) => ({
        id: item.id,
        mockTestId: item.mockTestId,
        questionId: item.questionId,
        position: item.position,
      })),
    );
  }

  /**
   * Fetches all mock tests along with question count and creator metadata.
   */
  async findAll(
    db: DbExecutor,
    options?: { search?: string },
  ): Promise<MockTestListItemProjection[]> {
    const baseQuery = db
      .select({
        id: mockTests.id,
        name: mockTests.name,
        totalMarks: mockTests.totalMarks,
        negativePercentagePerQuestion: mockTests.negativePercentagePerQuestion,
        durationSeconds: mockTests.duration_seconds,
        instructions: mockTests.instructions,
        createdAt: mockTests.createdAt,
        updatedAt: mockTests.updatedAt,
        creatorName: user.name,
        creatorEmail: user.email,
        questionCount: count(mockTestsQuestions.id),
      })
      .from(mockTests)
      .leftJoin(user, eq(mockTests.userId, user.id))
      .leftJoin(
        mockTestsQuestions,
        eq(mockTests.id, mockTestsQuestions.mockTestId),
      )
      .groupBy(
        mockTests.id,
        mockTests.name,
        mockTests.totalMarks,
        mockTests.negativePercentagePerQuestion,
        mockTests.duration_seconds,
        mockTests.instructions,
        mockTests.createdAt,
        mockTests.updatedAt,
        user.name,
        user.email,
      )
      .orderBy(desc(mockTests.createdAt));

    const records = options?.search?.trim()
      ? await baseQuery.where(ilike(mockTests.name, `%${options.search.trim()}%`))
      : await baseQuery;

    return records.map((r) => ({
      id: r.id,
      name: r.name,
      totalMarks: r.totalMarks,
      negativePercentagePerQuestion: r.negativePercentagePerQuestion,
      durationSeconds: r.durationSeconds,
      instructions: r.instructions,
      questionCount: Number(r.questionCount || 0),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      creatorName: r.creatorName,
      creatorEmail: r.creatorEmail,
    }));
  }

  /**
   * Fetches a single mock test by ID including its questions in correct sequence.
   */
  async findById(
    db: DbExecutor,
    id: string,
  ): Promise<MockTestDetailsProjection | null> {
    const [test] = await db
      .select({
        id: mockTests.id,
        name: mockTests.name,
        totalMarks: mockTests.totalMarks,
        negativePercentagePerQuestion: mockTests.negativePercentagePerQuestion,
        durationSeconds: mockTests.duration_seconds,
        instructions: mockTests.instructions,
        createdAt: mockTests.createdAt,
        updatedAt: mockTests.updatedAt,
        creatorName: user.name,
        creatorEmail: user.email,
      })
      .from(mockTests)
      .leftJoin(user, eq(mockTests.userId, user.id))
      .where(eq(mockTests.id, id))
      .limit(1);

    if (!test) return null;

    const questionRecords = await db
      .select({
        id: mockTestsQuestions.id,
        questionId: questions.id,
        position: mockTestsQuestions.position,
        question: questions.question,
        marks: questions.marks,
        difficulty: questions.difficulty,
        options: questions.options,
        correctOption: questions.correctOption,
        hint: questions.hint,
        solution: questions.solution,
        questionDiagram: questions.questionDiagram,
        solutionDiagram: questions.solutionDiagram,
        documentTitle: documents.title,
      })
      .from(mockTestsQuestions)
      .innerJoin(questions, eq(mockTestsQuestions.questionId, questions.id))
      .leftJoin(documentFiles, eq(questions.fileId, documentFiles.id))
      .leftJoin(documents, eq(documentFiles.documentId, documents.id))
      .where(eq(mockTestsQuestions.mockTestId, id))
      .orderBy(asc(mockTestsQuestions.position));

    const mappedQuestions: MockTestQuestionItemProjection[] =
      questionRecords.map((q) => ({
        id: q.id,
        questionId: q.questionId,
        position: q.position,
        question: q.question,
        marks: q.marks,
        difficulty: q.difficulty,
        options: q.options as Array<{ key: string; text: string }>,
        correctOption: q.correctOption,
        hint: q.hint,
        solution: q.solution,
        questionDiagram: q.questionDiagram,
        solutionDiagram: q.solutionDiagram,
        documentTitle: q.documentTitle,
      }));

    return {
      id: test.id,
      name: test.name,
      totalMarks: test.totalMarks,
      negativePercentagePerQuestion: test.negativePercentagePerQuestion,
      durationSeconds: test.durationSeconds,
      instructions: test.instructions,
      questionCount: mappedQuestions.length,
      createdAt: test.createdAt,
      updatedAt: test.updatedAt,
      creatorName: test.creatorName,
      creatorEmail: test.creatorEmail,
      questions: mappedQuestions,
    };
  }

  /**
   * Deletes a mock test and cascades its questions.
   */
  async delete(db: DbExecutor, id: string): Promise<boolean> {
    await db
      .delete(mockTestsQuestions)
      .where(eq(mockTestsQuestions.mockTestId, id));

    const result = await db
      .delete(mockTests)
      .where(eq(mockTests.id, id))
      .returning({ id: mockTests.id });

    return result.length > 0;
  }

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
   * Fetches questions for a mock test attempt with passages grouped.
   * Returns questions with only necessary fields for taking the test (no correct answers, hints, solutions).
   */
  async findAttemptQuestions(
    db: DbExecutor,
    mockTestId: string,
  ): Promise<MockTestAttemptQuestionsProjection> {
    // Get all questions for this mock test in order
    const questionRecords = await db
      .select({
        linkId: mockTestsQuestions.id,
        questionId: questions.id,
        position: mockTestsQuestions.position,
        question: questions.question,
        marks: questions.marks,
        difficulty: questions.difficulty,
        options: questions.options,
        questionDiagram: questions.questionDiagram,
        passageId: questions.passageId,
      })
      .from(mockTestsQuestions)
      .innerJoin(questions, eq(mockTestsQuestions.questionId, questions.id))
      .where(eq(mockTestsQuestions.mockTestId, mockTestId))
      .orderBy(asc(mockTestsQuestions.position));

    // Collect unique passage IDs
    const passageIds = Array.from(
      new Set(
        questionRecords
          .filter((q) => q.passageId !== null)
          .map((q) => q.passageId!),
      ),
    );

    // Fetch passages if any
    let passageRecords: Array<{
      id: string;
      content: string;
    }> = [];

    if (passageIds.length > 0) {
      passageRecords = await db
        .select({
          id: passages.id,
          content: passages.content,
        })
        .from(passages)
        .where(inArray(passages.id, passageIds));
    }

    // Build passage map for quick lookup
    const passageMap = new Map(
      passageRecords.map((p) => [p.id, p.content]),
    );

    // Group questions by passage
    const passageQuestionMap = new Map<string, string[]>();
    for (const q of questionRecords) {
      if (q.passageId) {
        const existing = passageQuestionMap.get(q.passageId) || [];
        existing.push(q.questionId);
        passageQuestionMap.set(q.passageId, existing);
      }
    }

    // Build passages projection
    const passagesProjection: MockAttemptPassageProjection[] =
      Array.from(passageQuestionMap.entries()).map(([passageId, questionIds]) => ({
        id: passageId,
        content: passageMap.get(passageId) || "",
        questionIds,
      }));

    // Build questions projection
    const questionsProjection: MockAttemptQuestionProjection[] = questionRecords.map(
      (q) => {
        // Find passage position if this question belongs to a passage
        let passagePosition: number | null = null;
        if (q.passageId) {
          const passageQuestions = passageQuestionMap.get(q.passageId) || [];
          passagePosition = passageQuestions.indexOf(q.questionId);
        }

        return {
          id: q.linkId,
          questionId: q.questionId,
          position: q.position,
          question: q.question,
          marks: q.marks,
          difficulty: q.difficulty,
          options: q.options as Array<{ key: string; text: string }>,
          questionDiagram: q.questionDiagram,
          passageId: q.passageId,
          passagePosition,
        };
      },
    );

    return {
      questions: questionsProjection,
      passages: passagesProjection,
    };
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
        durationSeconds: mockTests.duration_seconds,
        totalMarks: mockTests.totalMarks,
        negativePercentagePerQuestion:
          mockTests.negativePercentagePerQuestion,
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
   * Batch fetch: questions for several mock tests with everything needed
   * to score and review them (position, options, marks, correct answer).
   */
  async findQuestionsByMockTestIds(
    db: DbExecutor,
    mockTestIds: string[],
  ): Promise<AttemptQuestionRowProjection[]> {
    if (mockTestIds.length === 0) return [];

    const records = await db
      .select({
        mockTestId: mockTestsQuestions.mockTestId,
        questionId: questions.id,
        position: mockTestsQuestions.position,
        question: questions.question,
        options: questions.options,
        marks: questions.marks,
        correctOption: questions.correctOption,
      })
      .from(mockTestsQuestions)
      .innerJoin(questions, eq(mockTestsQuestions.questionId, questions.id))
      .where(inArray(mockTestsQuestions.mockTestId, mockTestIds))
      .orderBy(asc(mockTestsQuestions.position));

    return records.map((r) => ({
      mockTestId: r.mockTestId,
      questionId: r.questionId,
      position: r.position,
      question: r.question,
      options: r.options as Array<{ key: string; text: string }>,
      marks: r.marks,
      correctOption: r.correctOption,
    }));
  }

  /**
   * Fetches a single question at a given position for a specific attempt,
   * including the user's saved answer (if any) and the correct option.
   */
  async findAttemptQuestionAtPosition(
    db: DbExecutor,
    params: { attemptId: string; mockTestId: string; position: number },
  ): Promise<{
    linkId: string;
    questionId: string;
    position: number;
    question: string;
    marks: number;
    difficulty: "easy" | "medium" | "hard";
    options: Array<{ key: string; text: string }>;
    questionDiagram: string | null;
    passageId: string | null;
    correctOption: string;
    selectedOption: string | null;
    solution: string | null;
    solutionDiagram: string | null;
  } | null> {
    const { attemptId, mockTestId, position } = params;

    const records = await db
      .select({
        linkId: mockTestsQuestions.id,
        questionId: questions.id,
        position: mockTestsQuestions.position,
        question: questions.question,
        marks: questions.marks,
        difficulty: questions.difficulty,
        options: questions.options,
        questionDiagram: questions.questionDiagram,
        passageId: questions.passageId,
        correctOption: questions.correctOption,
        selectedOption: mockAttemptAnswers.selectedOption,
        solution: questions.solution,
        solutionDiagram: questions.solutionDiagram,
      })
      .from(mockTestsQuestions)
      .innerJoin(questions, eq(mockTestsQuestions.questionId, questions.id))
      .leftJoin(
        mockAttemptAnswers,
        and(
          eq(mockAttemptAnswers.attemptId, attemptId),
          eq(mockAttemptAnswers.questionId, questions.id),
        ),
      )
      .where(
        and(
          eq(mockTestsQuestions.mockTestId, mockTestId),
          eq(mockTestsQuestions.position, position),
        ),
      )
      .limit(1);

    if (records.length === 0) return null;

    const r = records[0];
    return {
      linkId: r.linkId,
      questionId: r.questionId,
      position: r.position,
      question: r.question,
      marks: r.marks,
      difficulty: r.difficulty,
      options: r.options as Array<{ key: string; text: string }>,
      questionDiagram: r.questionDiagram,
      passageId: r.passageId,
      correctOption: r.correctOption,
      selectedOption: r.selectedOption,
      solution: r.solution,
      solutionDiagram: r.solutionDiagram,
    };
  }

  /**
   * Fetches a passage with its sibling question IDs for a specific mock test.
   */
  async findPassageForTest(
    db: DbExecutor,
    params: { mockTestId: string; passageId: string },
  ): Promise<MockAttemptPassageProjection | null> {
    const { mockTestId, passageId } = params;

    // Get passage content
    const [passageRecord] = await db
      .select({
        id: passages.id,
        content: passages.content,
      })
      .from(passages)
      .where(eq(passages.id, passageId))
      .limit(1);

    if (!passageRecord) return null;

    // Get sibling question IDs in this mock test that belong to the same passage
    const siblingRecords = await db
      .select({
        questionId: mockTestsQuestions.questionId,
      })
      .from(mockTestsQuestions)
      .innerJoin(questions, eq(mockTestsQuestions.questionId, questions.id))
      .where(
        and(
          eq(mockTestsQuestions.mockTestId, mockTestId),
          eq(questions.passageId, passageId),
        ),
      )
      .orderBy(asc(mockTestsQuestions.position));

    return {
      id: passageRecord.id,
      content: passageRecord.content,
      questionIds: siblingRecords.map((r) => r.questionId),
    };
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
}

export const mockTestsRepository = new MockTestsRepository();
