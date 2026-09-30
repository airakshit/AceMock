import {
  documentFiles,
  documents,
  mockTests,
  mockTestsQuestions,
  questions,
  user,
} from "@/db/schemas";
import { asc, count, desc, eq, ilike, inArray } from "drizzle-orm";
import { DbExecutor } from "@/features/shared/types";
import {
  CreateMockTestCommand,
  CreateMockTestQuestionItemCommand,
} from "../dto/commands";
import {
  DocumentOptionForMockProjection,
  MockTestDetailsProjection,
  MockTestListItemProjection,
  MockTestQuestionItemProjection,
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
}

export const mockTestsRepository = new MockTestsRepository();
