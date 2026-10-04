import {
  documentFiles,
  documents,
  mockTests,
  mockTestsQuestions,
  mockAttemptAnswers,
  questions,
  passages,
  user,
} from "@/db/schemas";
import {
  SQL,
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  lt,
  or,
} from "drizzle-orm";
import { DbExecutor } from "@/features/shared/types";
import {
  CreateMockTestCommand,
  CreateMockTestQuestionItemCommand,
  SearchMockTestsQuery,
} from "../dto/commands";
import {
  MockTestDetailsProjection,
  MockTestListItemProjection,
  MockTestQuestionItemProjection,
  MockTestAttemptQuestionsProjection,
  MockAttemptQuestionProjection,
  MockAttemptPassageProjection,
  AttemptQuestionRowProjection
} from "../dto/projections";


export class MockTestsRepository {
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
        durationSeconds: data.durationSeconds,
        maxAttempts: data.maxAttempts,
        allowUntimed: data.allowUntimed,
        instructions: data.instructions ?? null,
        byAdmin: data.byAdmin,
        scope: data.scope,
        subjectId: data.subjectId,
        sectionId: data.sectionId,
        chapterId: data.chapterId,
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
        durationSeconds: mockTests.durationSeconds,
        maxAttempts: mockTests.maxAttempts,
        allowUntimed: mockTests.allowUntimed,
        instructions: mockTests.instructions,
        byAdmin: mockTests.byAdmin,
        scope: mockTests.scope,
        subjectId: mockTests.subjectId,
        sectionId: mockTests.sectionId,
        chapterId: mockTests.chapterId,
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
        mockTests.durationSeconds,
        mockTests.maxAttempts,
        mockTests.allowUntimed,
        mockTests.instructions,
        mockTests.byAdmin,
        mockTests.scope,
        mockTests.subjectId,
        mockTests.sectionId,
        mockTests.chapterId,
        mockTests.createdAt,
        mockTests.updatedAt,
        user.name,
        user.email,
      )
      .orderBy(desc(mockTests.createdAt), desc(mockTests.id));

    const records = options?.search?.trim()
      ? await baseQuery.where(
          ilike(mockTests.name, `%${options.search.trim()}%`),
        )
      : await baseQuery;

    return records.map((r) => ({
      id: r.id,
      name: r.name,
      totalMarks: r.totalMarks,
      negativePercentagePerQuestion: r.negativePercentagePerQuestion,
      durationSeconds: r.durationSeconds,
      maxAttempts: r.maxAttempts,
      allowUntimed: r.allowUntimed,
      instructions: r.instructions,
      questionCount: Number(r.questionCount || 0),
      byAdmin: r.byAdmin,
      scope: r.scope,
      subjectId: r.subjectId,
      sectionId: r.sectionId,
      chapterId: r.chapterId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      creatorName: r.creatorName,
      creatorEmail: r.creatorEmail,
    }));
  }

  /**
   * Keyset-paginated search over mock tests — every filter is optional and
   * they combine with AND.
   *
   * Ordering is `created_at DESC, id DESC`. When a hierarchy filter is set
   * (subject / section / chapter) `scope` leads the ordering, so a section's
   * own tests are listed before its chapters' tests — and a subject's tests
   * before its sections' and chapters'. The `mock_test_scope` enum is
   * declared in hierarchy order (ioe_model < subject < section < chapter <
   * miscellaneous) and a hierarchy filter can only match subject/section/
   * chapter rows (CHECK constraint), so `scope ASC` puts parents first.
   *
   * The matching keyset predicate carries `scope` whenever it leads the
   * ordering, which keeps pages gap-free and duplicate-free.
   */
  async search(
    db: DbExecutor,
    query: SearchMockTestsQuery,
  ): Promise<MockTestListItemProjection[]> {
    const conditions: SQL[] = [];

    if (query.scope) conditions.push(eq(mockTests.scope, query.scope));
    if (query.subjectId)
      conditions.push(eq(mockTests.subjectId, query.subjectId));
    if (query.sectionId)
      conditions.push(eq(mockTests.sectionId, query.sectionId));
    if (query.chapterId)
      conditions.push(eq(mockTests.chapterId, query.chapterId));
    if (query.byAdmin !== undefined)
      conditions.push(eq(mockTests.byAdmin, query.byAdmin));
    if (query.search?.trim())
      conditions.push(ilike(mockTests.name, `%${query.search.trim()}%`));

    const hierarchical = Boolean(
      query.subjectId || query.sectionId || query.chapterId,
    );

    if (query.cursor) {
      const withinScope = or(
        lt(mockTests.createdAt, query.cursor.createdAt),
        and(
          eq(mockTests.createdAt, query.cursor.createdAt),
          lt(mockTests.id, query.cursor.id),
        ),
      );

      conditions.push(
        (hierarchical
          ? or(
              gt(mockTests.scope, query.cursor.scope),
              and(eq(mockTests.scope, query.cursor.scope), withinScope),
            )
          : withinScope) as SQL,
      );
    }

    const orderColumns = hierarchical
      ? [asc(mockTests.scope), desc(mockTests.createdAt), desc(mockTests.id)]
      : [desc(mockTests.createdAt), desc(mockTests.id)];

    const records = await db
      .select({
        id: mockTests.id,
        name: mockTests.name,
        totalMarks: mockTests.totalMarks,
        negativePercentagePerQuestion: mockTests.negativePercentagePerQuestion,
        durationSeconds: mockTests.durationSeconds,
        maxAttempts: mockTests.maxAttempts,
        allowUntimed: mockTests.allowUntimed,
        instructions: mockTests.instructions,
        byAdmin: mockTests.byAdmin,
        scope: mockTests.scope,
        subjectId: mockTests.subjectId,
        sectionId: mockTests.sectionId,
        chapterId: mockTests.chapterId,
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
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(
        mockTests.id,
        mockTests.name,
        mockTests.totalMarks,
        mockTests.negativePercentagePerQuestion,
        mockTests.durationSeconds,
        mockTests.maxAttempts,
        mockTests.allowUntimed,
        mockTests.instructions,
        mockTests.byAdmin,
        mockTests.scope,
        mockTests.subjectId,
        mockTests.sectionId,
        mockTests.chapterId,
        mockTests.createdAt,
        mockTests.updatedAt,
        user.name,
        user.email,
      )
      .orderBy(...orderColumns)
      .limit(query.limit);

    return records.map((r) => ({
      id: r.id,
      name: r.name,
      totalMarks: r.totalMarks,
      negativePercentagePerQuestion: r.negativePercentagePerQuestion,
      durationSeconds: r.durationSeconds,
      maxAttempts: r.maxAttempts,
      allowUntimed: r.allowUntimed,
      instructions: r.instructions,
      questionCount: Number(r.questionCount || 0),
      byAdmin: r.byAdmin,
      scope: r.scope,
      subjectId: r.subjectId,
      sectionId: r.sectionId,
      chapterId: r.chapterId,
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
        durationSeconds: mockTests.durationSeconds,
        maxAttempts: mockTests.maxAttempts,
        allowUntimed: mockTests.allowUntimed,
        instructions: mockTests.instructions,
        byAdmin: mockTests.byAdmin,
        scope: mockTests.scope,
        subjectId: mockTests.subjectId,
        sectionId: mockTests.sectionId,
        chapterId: mockTests.chapterId,
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
      maxAttempts: test.maxAttempts,
      allowUntimed: test.allowUntimed,
      instructions: test.instructions,
      questionCount: mappedQuestions.length,
      byAdmin: test.byAdmin,
      scope: test.scope,
      subjectId: test.subjectId,
      sectionId: test.sectionId,
      chapterId: test.chapterId,
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
   * Fetches questions for a mock test attempt with passages grouped.
   * Returns questions with only necessary fields for taking the test (no correct answers, hints, solutions).
   */
  async getMockTestQuestionsForAttempt(
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
    const passageMap = new Map(passageRecords.map((p) => [p.id, p.content]));

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
    const passagesProjection: MockAttemptPassageProjection[] = Array.from(
      passageQuestionMap.entries(),
    ).map(([passageId, questionIds]) => ({
      id: passageId,
      content: passageMap.get(passageId) || "",
      questionIds,
    }));

    // Build questions projection
    const questionsProjection: MockAttemptQuestionProjection[] =
      questionRecords.map((q) => {
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
      });

    return {
      questions: questionsProjection,
      passages: passagesProjection,
    };
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
}

export const mockTestsRepository = new MockTestsRepository();
