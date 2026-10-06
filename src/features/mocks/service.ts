import { db } from "@/db";
import { eq } from "drizzle-orm";
import { ServerActionError } from "@/features/shared/actions/error";
import { supabaseStorageClient } from "@/features/shared/storage-service";
import { generateUUIDv7, isValidUUID } from "@/features/shared/utils";
import { chapters } from "@/db/schemas/questions/chapters";
import { sections } from "@/db/schemas/questions/sections";
import { subjects } from "@/db/schemas/questions/subjects";
import { questions } from "@/db/schemas/questions/questions";
import {
  CreateMockTestCommand,
  CreateMockTestQuestionItemCommand,
} from "./dto/commands";
import {
  CreateCustomMockTestPayload,
  CreateMockTestBasePayload,
  CreateMockTestFromDocumentsPayload,
  SearchMockTestsFiltersPayload,
  SearchMockTestsPayload,
} from "./dto/payloads";
import {
  MockTestDetailsProjection,
  MockTestListItemProjection,
  MockTestAttemptQuestionsProjection,
  AttemptDetailsProjection,
  AttemptHistoryItemProjection,
  AttemptMetaProjection,
  AttemptAnswerRowProjection,
  AttemptQuestionRowProjection,
  AttemptReviewIndexItem,
  MockAttemptQuestionProjection,
  MockAttemptPassageProjection,
  MockTestAttemptProjection,
  ReviewQuestionResult,
} from "./dto/projections";
import {
  CreateMockTestResult,
  DeleteMockTestResult,
  StartMockAttemptResult,
  SubmitAnswerResult,
  GetAttemptQuestionsResult,
  GetAttemptResult,
  AttemptHistoryResult,
  AttemptDetailsResult,
  AttemptReviewSummaryResult,
  MockTestSearchResult,
} from "./dto/results";
import { mockTestsRepository } from "./repositories/mock-tests.repository";
import {
  decodeMockTestCursor,
  encodeMockTestCursor,
  isMockTestScope,
} from "./utils";
import { documentsRepository } from "../documents/repositories/documents.repository";
import { questionsRepository } from "../questions/repositories/questions.repository";
import { mockTestAttemptRepository } from "./repositories/mock-attempts.repository";
import { curriculumRepository } from "../questions/repositories/curriculum.repository";

/** Rows returned per mock test search page. */
const MOCK_TESTS_PAGE_SIZE = 12;
const MAX_MOCK_TESTS_PAGE_SIZE = 50;

/** Curriculum columns of a newly created mock test. */
interface MockTestHierarchy {
  subjectId: string | null;
  sectionId: string | null;
  chapterId: string | null;
}

export class MockTestsService {
  /**
   * Creates a new mock test directly from selected documents.
   * Pulls all questions associated with the chosen documents and links them in sequence.
   *
   * Admin path: the action guarding it calls `requireAdmin()`, so the test is
   * stored with `byAdmin = true`, may override the summed marks, and is not
   * restricted to documents the caller owns.
   */
  async createFromDocuments(
    userId: string,
    payload: CreateMockTestFromDocumentsPayload,
  ): Promise<CreateMockTestResult> {
    return this.buildMockTestFromDocuments(userId, payload, {
      byAdmin: true,
      requireOwnedDocuments: false,
      totalMarksOverride: payload.customTotalMarks,
    });
  }

  /**
   * Creates a custom mock test for the signed-in student from documents they
   * uploaded themselves. Every question belonging to the selected documents
   * is included — there is no question-level selection.
   *
   * `totalMarks` is never accepted from the client here: it is always the sum
   * of the selected questions' marks, computed in the builder below.
   */
  async createCustomMockTest(
    userId: string,
    payload: CreateCustomMockTestPayload,
  ): Promise<CreateMockTestResult> {
    return this.buildMockTestFromDocuments(userId, payload, {
      byAdmin: false,
      requireOwnedDocuments: true,
    });
  }

  /**
   * Shared builder behind both creation paths.
   *
   * `totalMarksOverride` only ever reaches the builder from the admin action,
   * so a student-created test can never carry an arbitrary marks value.
   */
  private async buildMockTestFromDocuments(
    userId: string,
    payload: CreateMockTestBasePayload,
    options: {
      byAdmin: boolean;
      requireOwnedDocuments: boolean;
      /** Admin-only override for the summed question marks. */
      totalMarksOverride?: number;
    },
  ): Promise<CreateMockTestResult> {
    const trimmedName = payload.name?.trim();
    if (!trimmedName) {
      throw new ServerActionError(
        "INVALID_ARGUMENT",
        "Mock test name is required.",
      );
    }

    if (!isMockTestScope(payload.scope)) {
      throw new ServerActionError(
        "INVALID_ARGUMENT",
        "Please select where this mock test belongs (IOE model, subject, section, chapter or miscellaneous).",
      );
    }

    if (!payload.documentIds || payload.documentIds.length === 0) {
      throw new ServerActionError(
        "INVALID_ARGUMENT",
        "Please select at least one document to generate the mock test from.",
      );
    }

    if (payload.documentIds.some((id) => !isValidUUID(id))) {
      throw new ServerActionError(
        "INVALID_ARGUMENT",
        "One or more of the selected documents is invalid.",
      );
    }

    // A student may only assemble a test from their own uploads. The
    // ownership set is computed from ids the caller provably owns, so a
    // foreign id is rejected without confirming whether it exists.
    if (options.requireOwnedDocuments) {
      const ownedIds = await documentsRepository.findByIdsForUser(
        db,
        userId,
        payload.documentIds,
      );
      const owned = new Set(ownedIds);

      if (payload.documentIds.some((id) => !owned.has(id))) {
        throw new ServerActionError(
          "FORBIDDEN",
          "You can only create a mock test from documents you uploaded.",
        );
      }
    }

    // Test rules: timing is opt-in untimed (a test stays an exam unless the
    // admin says otherwise) and the retake limit is 0 = unlimited.
    const allowUntimed = payload.allowUntimed === true;
    const maxAttempts = payload.maxAttempts ?? 1;
    if (
      !Number.isInteger(maxAttempts) ||
      maxAttempts < 0 ||
      maxAttempts > 100
    ) {
      throw new ServerActionError(
        "INVALID_ARGUMENT",
        "Max attempts must be a whole number between 1 and 100 (use 0 for unlimited).",
      );
    }

    // Resolve (and validate) the hierarchy before writing anything.
    const hierarchy = await this.resolveHierarchy(payload);

    const durationMinutes =
      payload.durationMinutes > 0 ? payload.durationMinutes : 60;
    const durationSeconds = durationMinutes * 60;
    const negativePercent = Math.max(
      0,
      Math.min(100, Math.round(payload.negativePercentagePerQuestion || 0)),
    );

    // Fetch all questions originating from the selected documents
    const matchedQuestions =
      await questionsRepository.findQuestionsByDocumentIds(
        db,
        payload.documentIds,
      );

    if (matchedQuestions.length === 0) {
      throw new ServerActionError(
        "INVALID_ARGUMENT",
        "No questions found in the selected document(s). Please make sure the documents have extracted questions.",
      );
    }

    // Inferred from the selected questions — every question in the chosen
    // documents is taken, so their marks are the test's marks.
    const totalMarks =
      options.totalMarksOverride && options.totalMarksOverride > 0
        ? options.totalMarksOverride
        : matchedQuestions.reduce((acc, q) => acc + (q.marks || 1), 0);

    const mockTestId = generateUUIDv7();

    const mockTestCommand: CreateMockTestCommand = {
      id: mockTestId,
      userId,
      name: trimmedName,
      totalMarks,
      negativePercentagePerQuestion: negativePercent,
      durationSeconds,
      instructions: payload.instructions?.trim() || null,
      byAdmin: options.byAdmin,
      scope: payload.scope,
      allowUntimed,
      maxAttempts,
      ...hierarchy,
    };

    const questionItemsCommand: CreateMockTestQuestionItemCommand[] =
      matchedQuestions.map((q, idx) => ({
        id: generateUUIDv7(),
        mockTestId,
        questionId: q.id,
        position: idx + 1,
      }));

    // Atomically persist the test and all question assignments
    await db.transaction(async (tx) => {
      await mockTestsRepository.create(tx, mockTestCommand);
      await mockTestsRepository.createMockTestQuestions(
        tx,
        questionItemsCommand,
      );
    });

    return {
      id: mockTestId,
      name: trimmedName,
      totalMarks,
      totalQuestions: matchedQuestions.length,
      durationSeconds,
      negativePercentagePerQuestion: negativePercent,
    };
  }

  /**
   * Resolves the curriculum columns of a new mock test from the entity that
   * was actually selected — never from client-supplied parent ids:
   *
   *   ioe_model / miscellaneous → all null
   *   subject                   → the selected subject
   *   section                   → the section's subject + the section
   *   chapter                   → the chapter's section + that section's subject
   *
   * Guarantees the row satisfies `mock_test_scope_reference_check`.
   */
  private async resolveHierarchy(
    payload: CreateMockTestBasePayload,
  ): Promise<MockTestHierarchy> {
    const empty: MockTestHierarchy = {
      subjectId: null,
      sectionId: null,
      chapterId: null,
    };

    switch (payload.scope) {
      case "ioe_model":
      case "miscellaneous":
        return empty;

      case "subject": {
        const subjectId = payload.subjectId?.trim() || "";
        if (!subjectId) {
          throw new ServerActionError(
            "INVALID_ARGUMENT",
            "Please select a subject for this mock test.",
          );
        }
        if (!isValidUUID(subjectId)) {
          throw new ServerActionError(
            "INVALID_ARGUMENT",
            "The selected subject is invalid.",
          );
        }

        const subject = await curriculumRepository.findSubjectById(
          db,
          subjectId,
        );
        if (!subject) {
          throw new ServerActionError(
            "NOT_FOUND",
            "The selected subject no longer exists.",
          );
        }

        return { ...empty, subjectId: subject.id };
      }

      case "section": {
        const sectionId = payload.sectionId?.trim() || "";
        if (!sectionId) {
          throw new ServerActionError(
            "INVALID_ARGUMENT",
            "Please select a section for this mock test.",
          );
        }
        if (!isValidUUID(sectionId)) {
          throw new ServerActionError(
            "INVALID_ARGUMENT",
            "The selected section is invalid.",
          );
        }

        const section = await curriculumRepository.findSectionById(
          db,
          sectionId,
        );
        if (!section) {
          throw new ServerActionError(
            "NOT_FOUND",
            "The selected section no longer exists.",
          );
        }

        // Derived from the section itself — the payload's subjectId is ignored.
        return { ...empty, subjectId: section.subjectId, sectionId };
      }

      case "chapter": {
        const chapterId = payload.chapterId?.trim() || "";
        if (!chapterId) {
          throw new ServerActionError(
            "INVALID_ARGUMENT",
            "Please select a chapter for this mock test.",
          );
        }
        if (!isValidUUID(chapterId)) {
          throw new ServerActionError(
            "INVALID_ARGUMENT",
            "The selected chapter is invalid.",
          );
        }

        const chapter = await curriculumRepository.findChapterById(
          db,
          chapterId,
        );
        if (!chapter) {
          throw new ServerActionError(
            "NOT_FOUND",
            "The selected chapter no longer exists.",
          );
        }

        const section = await curriculumRepository.findSectionById(
          db,
          chapter.sectionId,
        );
        if (!section) {
          throw new ServerActionError(
            "NOT_FOUND",
            "The section owning the selected chapter no longer exists.",
          );
        }

        // Both parents derived from the chapter — payload ids are ignored.
        return {
          subjectId: section.subjectId,
          sectionId: section.id,
          chapterId: chapter.id,
        };
      }

      default:
        throw new ServerActionError(
          "INVALID_ARGUMENT",
          `Unknown mock test scope: ${String(payload.scope)}.`,
        );
    }
  }

  /**
   * Retrieves all mock tests with stats for admin view.
   */
  async getAllMockTests(options?: {
    search?: string;
  }): Promise<MockTestListItemProjection[]> {
    return await mockTestsRepository.findAll(db, options);
  }

  /**
   * Cursor-paginated search over mock tests (scope / hierarchy / name
   * filters), restricted to the tests published by the application.
   *
   * This backs `/mocks/tests`: students must never see tests authored by
   * another user, so the creator flags are pinned here rather than accepted
   * from the payload.
   */
  async searchApplicationTests(
    payload: SearchMockTestsFiltersPayload = {},
  ): Promise<MockTestSearchResult> {
    return this.runSearch(payload, { byAdmin: true });
  }

  /**
   * Cursor-paginated search restricted to the tests the given user authored
   * themselves (admin-panel creations are excluded).
   *
   * This backs `/mocks/custom`: the `userId` always comes from the session,
   * never from the client, so a caller cannot read someone else's tests.
   */
  async searchMyCustomTests(
    userId: string,
    payload: SearchMockTestsFiltersPayload = {},
  ): Promise<MockTestSearchResult> {
    return this.runSearch(payload, { userId, byAdmin: false });
  }

  /**
   * Admin panel search — the only entry point where the caller chooses the
   * creator flag (`byAdmin` / unrestricted).
   */
  async searchMockTests(
    payload: SearchMockTestsPayload = {},
  ): Promise<MockTestSearchResult> {
    return this.runSearch(payload, { byAdmin: payload.byAdmin });
  }

  /**
   * Single keyset-paginated search shared by every caller above.
   *
   * Fetches `pageSize + 1` rows to decide `hasNextPage`, so pages never skip
   * or duplicate a record: `nextCursor` holds the exact ORDER BY key of the
   * last returned row and must be replayed with the same filters.
   *
   * `creator` is applied verbatim and cannot be overridden by the payload —
   * it is the one thing the client has no say in.
   */
  private async runSearch(
    payload: SearchMockTestsFiltersPayload,
    creator: { byAdmin?: boolean; userId?: string },
  ): Promise<MockTestSearchResult> {
    if (payload.scope !== undefined && !isMockTestScope(payload.scope)) {
      throw new ServerActionError(
        "INVALID_ARGUMENT",
        `Unknown mock test scope: ${String(payload.scope)}.`,
      );
    }

    const hierarchyFilters = {
      subjectId: payload.subjectId,
      sectionId: payload.sectionId,
      chapterId: payload.chapterId,
    } as const;

    for (const [key, value] of Object.entries(hierarchyFilters)) {
      if (value && !isValidUUID(value)) {
        throw new ServerActionError(
          "INVALID_ARGUMENT",
          `Invalid ${key} filter.`,
        );
      }
    }

    const pageSize = Math.min(
      Math.max(Math.round(payload.pageSize ?? MOCK_TESTS_PAGE_SIZE), 1),
      MAX_MOCK_TESTS_PAGE_SIZE,
    );

    const cursor = payload.cursor ? decodeMockTestCursor(payload.cursor) : null;

    // One extra row reveals whether another page exists — no OFFSET needed.
    const rows = await mockTestsRepository.search(db, {
      scope: payload.scope,
      subjectId: hierarchyFilters.subjectId?.trim() || undefined,
      sectionId: hierarchyFilters.sectionId?.trim() || undefined,
      chapterId: hierarchyFilters.chapterId?.trim() || undefined,
      byAdmin: creator.byAdmin,
      userId: creator.userId,
      search: payload.search?.trim() || undefined,
      cursor,
      limit: pageSize + 1,
    });

    const hasNextPage = rows.length > pageSize;
    const items = hasNextPage ? rows.slice(0, pageSize) : rows;
    const lastItem = items[items.length - 1];

    return {
      items,
      hasNextPage,
      nextCursor:
        hasNextPage && lastItem
          ? encodeMockTestCursor({
              scope: lastItem.scope,
              createdAt: lastItem.createdAt,
              id: lastItem.id,
            })
          : null,
    };
  }

  /**
   * Retrieves single mock test details with ordered questions.
   */
  async getMockTestById(id: string): Promise<MockTestDetailsProjection> {
    const test = await mockTestsRepository.findById(db, id);
    if (!test) {
      throw new ServerActionError(
        "NOT_FOUND",
        `Mock test with ID ${id} was not found.`,
      );
    }
    return test;
  }

  /**
   * Deletes a mock test and all its question associations.
   */
  async deleteMockTest(id: string): Promise<DeleteMockTestResult> {
    const existing = await mockTestsRepository.findById(db, id);
    if (!existing) {
      throw new ServerActionError(
        "NOT_FOUND",
        `Mock test with ID ${id} was not found.`,
      );
    }

    await mockTestsRepository.delete(db, id);
    return {
      deletedId: id,
      success: true,
    };
  }

  /**
   * Starts a new mock test attempt for the current user.
   * Creates an attempt record and loads all questions with passages.
   */
  async startMockAttempt(
    userId: string,
    mockTestId: string,
  ): Promise<StartMockAttemptResult> {
    // Load the test first — it holds the attempt rules and its absence must
    // not leave an orphaned attempt row behind.
    const mockTest = await mockTestsRepository.findById(db, mockTestId);
    if (!mockTest) {
      throw new ServerActionError(
        "NOT_FOUND",
        `Mock test with ID ${mockTestId} was not found.`,
      );
    }

    // Check if there's already an in-progress attempt
    const existingAttempt =
      await mockTestAttemptRepository.findInProgressAttempt(
        db,
        userId,
        mockTestId,
      );

    let attempt = existingAttempt;

    if (!attempt) {
      // Retake limit — only a brand-new attempt counts against it, so an
      // in-progress attempt can always be resumed. 0 = unlimited.
      if (mockTest.maxAttempts > 0) {
        const usedAttempts = await mockTestAttemptRepository.countUserAttempts(
          db,
          userId,
          mockTestId,
        );

        if (usedAttempts >= mockTest.maxAttempts) {
          throw new ServerActionError(
            "ATTEMPT_LIMIT_REACHED",
            mockTest.maxAttempts === 1
              ? "You have already used your only attempt for this test."
              : `You have used all ${mockTest.maxAttempts} attempts allowed for this test.`,
          );
        }
      }

      // Create new attempt
      const attemptId = generateUUIDv7();
      await mockTestAttemptRepository.createAttempt(db, {
        id: attemptId,
        userId,
        mockTestId,
      });

      attempt = await mockTestAttemptRepository.findAttemptById(db, attemptId);
      if (!attempt) {
        throw new ServerActionError(
          "INTERNAL_ERROR",
          "Failed to create mock test attempt.",
        );
      }
    }

    // Load questions with passages
    const questions = await mockTestsRepository.getMockTestQuestionsForAttempt(
      db,
      mockTestId,
    );
    await this.signAttemptQuestionDiagrams(questions);

    // Load previously saved answers so a resumed attempt keeps its state
    const answers = await mockTestAttemptRepository.findAttemptAnswers(
      db,
      attempt.id,
    );

    return {
      attempt,
      questions,
      answers,
      mockTest: {
        id: mockTest.id,
        name: mockTest.name,
        totalMarks: mockTest.totalMarks,
        totalQuestions: mockTest.questionCount,
        durationSeconds: mockTest.durationSeconds,
        maxAttempts: mockTest.maxAttempts,
        allowUntimed: mockTest.allowUntimed,
        negativePercentagePerQuestion: mockTest.negativePercentagePerQuestion,
        instructions: mockTest.instructions,
      },
    };
  }

  async getQuestionsForMockTestAttempt(
    attemptId: string,
    userId: string,
  ): Promise<GetAttemptQuestionsResult> {
    const attempt = await mockTestAttemptRepository.findAttemptById(
      db,
      attemptId,
    );
    if (!attempt) {
      throw new ServerActionError(
        "NOT_FOUND",
        `Attempt with ID ${attemptId} was not found.`,
      );
    }

    // Verify ownership
    if (attempt.userId !== userId) {
      throw new ServerActionError(
        "FORBIDDEN",
        "You do not have access to this attempt.",
      );
    }

    const questions = await mockTestsRepository.getMockTestQuestionsForAttempt(
      db,
      attempt.mockTestId,
    );
    await this.signAttemptQuestionDiagrams(questions);

    return {
      attempt,
      questions,
    };
  }

  /**
   * Replaces diagram storage paths with time-limited signed URLs so the
   * exam UI can render them. Failures are non-fatal — raw paths are kept.
   * Also handles solution diagrams.
   */
  private async signAttemptQuestionDiagrams(
    data: MockTestAttemptQuestionsProjection,
  ): Promise<void> {
    // Collect question diagram paths
    const questionDiagramPaths = Array.from(
      new Set(
        data.questions
          .map((q) => q.questionDiagram)
          .filter((p): p is string => !!p && !p.startsWith("http")),
      ),
    );

    // Collect solution diagram paths
    const solutionDiagramPaths = Array.from(
      new Set(
        data.questions
          .map((q) => q.solutionDiagram)
          .filter((p): p is string => !!p && !p.startsWith("http")),
      ),
    );

    const allPaths = [...questionDiagramPaths, ...solutionDiagramPaths];

    if (allPaths.length === 0) return;

    try {
      const signed = await supabaseStorageClient.getPageAccessUrls(allPaths);
      const urlMap = new Map(signed.map((s) => [s.path, s.signedUrl]));

      for (const question of data.questions) {
        if (
          question.questionDiagram &&
          !question.questionDiagram.startsWith("http")
        ) {
          question.questionDiagram =
            urlMap.get(question.questionDiagram) || question.questionDiagram;
        }
        if (
          question.solutionDiagram &&
          !question.solutionDiagram.startsWith("http")
        ) {
          question.solutionDiagram =
            urlMap.get(question.solutionDiagram) || question.solutionDiagram;
        }
      }
    } catch {
      // Keep raw paths; the UI degrades gracefully when an image fails.
    }
  }

  /**
   * Submits an answer for a question in an attempt.
   */
  async submitAttemptAnswer(
    userId: string,
    attemptId: string,
    questionId: string,
    selectedOption: "A" | "B" | "C" | "D",
  ): Promise<SubmitAnswerResult> {
    const attempt = await mockTestAttemptRepository.findAttemptById(
      db,
      attemptId,
    );
    if (!attempt) {
      throw new ServerActionError(
        "NOT_FOUND",
        `Attempt with ID ${attemptId} was not found.`,
      );
    }

    // Verify ownership
    if (attempt.userId !== userId) {
      throw new ServerActionError(
        "FORBIDDEN",
        "You do not have access to this attempt.",
      );
    }

    // Verify attempt is still in progress
    if (attempt.status !== "in_progress") {
      throw new ServerActionError(
        "INVALID_STATE",
        "Cannot submit answers to a completed attempt.",
      );
    }

    const answerId = generateUUIDv7();
    const answer = await mockTestAttemptRepository.upsertAttemptAnswer(db, {
      id: answerId,
      attemptId,
      questionId,
      selectedOption,
    });

    return {
      answer: {
        id: answer.id,
        attemptId: answer.attemptId,
        questionId: answer.questionId,
        selectedOption: answer.selectedOption as "A" | "B" | "C" | "D",
        createdAt: answer.createdAt,
        updatedAt: answer.updatedAt,
      },
    };
  }

  /**
   * Completes a mock test attempt.
   */
  async completeMockAttempt(userId: string, attemptId: string): Promise<void> {
    const attempt = await mockTestAttemptRepository.findAttemptById(
      db,
      attemptId,
    );
    if (!attempt) {
      throw new ServerActionError(
        "NOT_FOUND",
        `Attempt with ID ${attemptId} was not found.`,
      );
    }

    // Verify ownership
    if (attempt.userId !== userId) {
      throw new ServerActionError(
        "FORBIDDEN",
        "You do not have access to this attempt.",
      );
    }

    // Verify attempt is still in progress
    if (attempt.status !== "in_progress") {
      throw new ServerActionError(
        "INVALID_STATE",
        "Attempt is already completed.",
      );
    }

    await mockTestAttemptRepository.completeAttempt(db, { attemptId });
  }

  /**
   * Gets an attempt with mock test metadata.
   */
  async getAttempt(
    userId: string,
    attemptId: string,
  ): Promise<GetAttemptResult> {
    const attempt = await mockTestAttemptRepository.findAttemptById(
      db,
      attemptId,
    );
    if (!attempt) {
      throw new ServerActionError(
        "NOT_FOUND",
        `Attempt with ID ${attemptId} was not found.`,
      );
    }

    // Verify ownership
    if (attempt.userId !== userId) {
      throw new ServerActionError(
        "FORBIDDEN",
        "You do not have access to this attempt.",
      );
    }

    const mockTest = await mockTestsRepository.findById(db, attempt.mockTestId);
    if (!mockTest) {
      throw new ServerActionError(
        "NOT_FOUND",
        `Mock test with ID ${attempt.mockTestId} was not found.`,
      );
    }

    return {
      attempt,
      mockTest: {
        id: mockTest.id,
        name: mockTest.name,
        totalMarks: mockTest.totalMarks,
        totalQuestions: mockTest.questionCount,
        durationSeconds: mockTest.durationSeconds,
        maxAttempts: mockTest.maxAttempts,
        allowUntimed: mockTest.allowUntimed,
        negativePercentagePerQuestion: mockTest.negativePercentagePerQuestion,
        instructions: mockTest.instructions,
      },
    };
  }

  // ------------------------------------------------------------------
  // Attempt history ("My History")
  // ------------------------------------------------------------------

  /**
   * Scores one attempt: correct/wrong/unattempted counts, earned marks and
   * accuracy, based on the test's questions and the user's saved answers.
   */
  private summarizeAttempt(
    meta: AttemptMetaProjection,
    questionRows: AttemptQuestionRowProjection[],
    answerRows: AttemptAnswerRowProjection[],
  ): AttemptHistoryItemProjection {
    const selectedByQuestion = new Map(
      answerRows.map((a) => [a.questionId, a.selectedOption.toUpperCase()]),
    );

    let attempted = 0;
    let correct = 0;
    let incorrect = 0;
    let score = 0;

    for (const question of questionRows) {
      const selected = selectedByQuestion.get(question.questionId);
      if (!selected) continue;

      attempted++;
      if (selected === question.correctOption.toUpperCase()) {
        correct++;
        score += question.marks;
      } else {
        incorrect++;
        score -= (question.marks * meta.negativePercentagePerQuestion) / 100;
      }
    }

    const totalQuestions = questionRows.length;
    const unattempted = Math.max(0, totalQuestions - attempted);

    return {
      id: meta.id,
      mockTestId: meta.mockTestId,
      mockTestName: meta.mockTestName,
      status: meta.status,
      startedAt: meta.startedAt,
      submittedAt: meta.submittedAt,
      durationSeconds: meta.durationSeconds,
      totalMarks: meta.totalMarks,
      negativePercentagePerQuestion: meta.negativePercentagePerQuestion,
      totalQuestions,
      attemptedCount: attempted,
      unattemptedCount: unattempted,
      correctCount: correct,
      incorrectCount: incorrect,
      scoreMarks: Math.round(score * 100) / 100,
      accuracyPercent:
        attempted > 0 ? Math.round((correct / attempted) * 100) : 0,
    };
  }

  /**
   * Scored summary of every attempt made by the current user, newest first.
   * When `mockTestId` is given, only that test's attempts are returned.
   */
  async getMyAttemptHistory(
    userId: string,
    mockTestId?: string,
  ): Promise<AttemptHistoryResult> {
    const attempts = await mockTestAttemptRepository.findUserAttempts(
      db,
      userId,
      mockTestId,
    );
    if (attempts.length === 0) return [];

    const answers = await mockTestAttemptRepository.findAnswersForAttempts(
      db,
      attempts.map((a) => a.id),
    );

    const mockTestIds = Array.from(new Set(attempts.map((a) => a.mockTestId)));
    const questionRows = await mockTestsRepository.findQuestionsByMockTestIds(
      db,
      mockTestIds,
    );

    const questionsByTest = new Map<string, AttemptQuestionRowProjection[]>();
    for (const row of questionRows) {
      const list = questionsByTest.get(row.mockTestId) ?? [];
      list.push(row);
      questionsByTest.set(row.mockTestId, list);
    }

    const answersByAttempt = new Map<string, AttemptAnswerRowProjection[]>();
    for (const row of answers) {
      const list = answersByAttempt.get(row.attemptId) ?? [];
      list.push(row);
      answersByAttempt.set(row.attemptId, list);
    }

    return attempts.map((attempt) =>
      this.summarizeAttempt(
        attempt,
        questionsByTest.get(attempt.mockTestId) ?? [],
        answersByAttempt.get(attempt.id) ?? [],
      ),
    );
  }

  // ------------------------------------------------------------------
  // Attempt review (completed attempts only)
  // ------------------------------------------------------------------

  /**
   * Shared guard: fetches a completed attempt + its mock test, or throws
   * NOT_FOUND / FORBIDDEN / INVALID_STATE.
   */
  private async requireCompletedAttemptForReview(
    userId: string,
    attemptId: string,
  ): Promise<{
    attempt: MockTestAttemptProjection;
    mockTest: MockTestDetailsProjection;
  }> {
    const attempt = await mockTestAttemptRepository.findAttemptById(
      db,
      attemptId,
    );
    if (!attempt) {
      throw new ServerActionError(
        "NOT_FOUND",
        `Attempt with ID ${attemptId} was not found.`,
      );
    }

    if (attempt.userId !== userId) {
      throw new ServerActionError(
        "FORBIDDEN",
        "You do not have access to this attempt.",
      );
    }

    if (attempt.status !== "completed") {
      throw new ServerActionError(
        "INVALID_STATE",
        "This attempt is still in progress. Complete the test to review it.",
      );
    }

    const mockTest = await mockTestsRepository.findById(db, attempt.mockTestId);
    if (!mockTest) {
      throw new ServerActionError(
        "NOT_FOUND",
        `Mock test with ID ${attempt.mockTestId} was not found.`,
      );
    }

    return { attempt, mockTest };
  }

  /**
   * Summary of a completed attempt with a minimal index (position + status)
   * for the question navigator. No per-question payload — lightweight.
   */
  async getAttemptReviewSummary(
    userId: string,
    attemptId: string,
  ): Promise<AttemptReviewSummaryResult> {
    const { attempt, mockTest } = await this.requireCompletedAttemptForReview(
      userId,
      attemptId,
    );

    const questionRows = await mockTestsRepository.findQuestionsByMockTestIds(
      db,
      [attempt.mockTestId],
    );
    const answerRows = await mockTestAttemptRepository.findAnswersForAttempts(
      db,
      [attempt.id],
    );

    const meta: AttemptMetaProjection = {
      id: attempt.id,
      mockTestId: attempt.mockTestId,
      mockTestName: mockTest.name,
      status: attempt.status,
      startedAt: attempt.createdAt,
      submittedAt: attempt.submittedAt ?? null,
      durationSeconds: mockTest.durationSeconds,
      totalMarks: mockTest.totalMarks,
      negativePercentagePerQuestion: mockTest.negativePercentagePerQuestion,
    };

    const summary = this.summarizeAttempt(meta, questionRows, answerRows);

    const selectedByQuestion = new Map(
      answerRows.map((a) => [a.questionId, a.selectedOption.toUpperCase()]),
    );

    const index: AttemptReviewIndexItem[] = questionRows.map((question) => {
      const selected = selectedByQuestion.get(question.questionId) ?? null;
      let status: "correct" | "incorrect" | "unattempted";
      if (!selected) status = "unattempted";
      else if (selected === question.correctOption.toUpperCase())
        status = "correct";
      else status = "incorrect";

      return {
        questionId: question.questionId,
        position: question.position,
        status,
      };
    });

    return {
      attempt: {
        id: attempt.id,
        mockTestId: attempt.mockTestId,
        status: attempt.status,
        startedAt: attempt.createdAt,
        submittedAt: attempt.submittedAt ?? null,
      },
      mockTest: {
        id: mockTest.id,
        name: mockTest.name,
        totalMarks: mockTest.totalMarks,
        totalQuestions: mockTest.questionCount,
        durationSeconds: mockTest.durationSeconds,
        negativePercentagePerQuestion: mockTest.negativePercentagePerQuestion,
      },
      scoreMarks: summary.scoreMarks,
      accuracyPercent: summary.accuracyPercent,
      attemptedCount: summary.attemptedCount,
      correctCount: summary.correctCount,
      incorrectCount: summary.incorrectCount,
      unattemptedCount: summary.unattemptedCount,
      index,
    };
  }

  /**
   * Single question with full review data (correct answer, user answer, marks).
   * Loaded on demand when navigating the review.
   */
  async getReviewQuestion(
    userId: string,
    attemptId: string,
    position: number,
  ): Promise<ReviewQuestionResult> {
    const { attempt, mockTest } = await this.requireCompletedAttemptForReview(
      userId,
      attemptId,
    );

    const record = await mockTestsRepository.findAttemptQuestionAtPosition(db, {
      attemptId: attempt.id,
      mockTestId: attempt.mockTestId,
      position,
    });

    if (!record) {
      throw new ServerActionError(
        "NOT_FOUND",
        `Question ${position} not found in this test.`,
      );
    }

    // Fetch passage if this question belongs to one
    let passage: MockAttemptPassageProjection | null = null;
    if (record.passageId) {
      passage = await mockTestsRepository.findPassageForTest(db, {
        mockTestId: attempt.mockTestId,
        passageId: record.passageId,
      });
    }

    // Find passage position if applicable
    let passagePosition: number | null = null;
    if (passage) {
      passagePosition = passage.questionIds.indexOf(record.questionId);
    }

    // Fetch subject from chapter -> section -> subject (if available)
    let subject = "General";
    const [questionWithSubject] = await db
      .select({
        subjectName: subjects.name,
      })
      .from(questions)
      .innerJoin(chapters, eq(questions.chapterId, chapters.id))
      .innerJoin(sections, eq(chapters.sectionId, sections.id))
      .innerJoin(subjects, eq(sections.subjectId, subjects.id))
      .where(eq(questions.id, record.questionId))
      .limit(1);

    if (questionWithSubject?.subjectName) {
      subject = questionWithSubject.subjectName;
    }

    // Build the question projection with solution fields
    const question: MockAttemptQuestionProjection = {
      id: record.linkId,
      questionId: record.questionId,
      position: record.position,
      question: record.question,
      marks: record.marks,
      difficulty: record.difficulty,
      options: record.options,
      questionDiagram: record.questionDiagram,
      passageId: record.passageId,
      passagePosition,
      solution: record.solution,
      solutionDiagram: record.solutionDiagram,
    };

    // Sign diagram URLs if present (both question and solution diagrams)
    await this.signAttemptQuestionDiagrams({
      questions: [question],
      passages: passage ? [passage] : [],
    });

    const negativePercent = mockTest.negativePercentagePerQuestion;
    const selected = record.selectedOption?.toUpperCase() ?? null;
    const correct = record.correctOption.toUpperCase();
    const isCorrect = selected !== null && selected === correct;
    const marksAwarded =
      selected === null
        ? 0
        : isCorrect
          ? record.marks
          : Math.round(-record.marks * negativePercent) / 100;

    // Calculate negative marks (positive value for display)
    const negativeMarks =
      negativePercent > 0
        ? Math.round(record.marks * negativePercent) / 100
        : 0;

    return {
      ...question,
      // Map fields to match prebuilt QuestionCard expected interface
      subject,
      negativeMarks,
      passage,
      selectedOption: selected,
      correctOption: record.correctOption,
      isCorrect,
      marksAwarded: Math.round(marksAwarded * 100) / 100,
    };
  }

  /**
   * Fetches an attempt by ID for review page validation.
   * Returns the attempt with mock test ID if it exists and is completed.
   */
  async getAttemptForReview(
    attemptId: string,
  ): Promise<{ id: string; mockTestId: string; status: string } | null> {
    const attempt = await mockTestAttemptRepository.findAttemptById(
      db,
      attemptId,
    );
    if (!attempt) return null;
    if (attempt.status !== "completed") return null;
    return {
      id: attempt.id,
      mockTestId: attempt.mockTestId,
      status: attempt.status,
    };
  }
}

export const mockTestsService = new MockTestsService();
