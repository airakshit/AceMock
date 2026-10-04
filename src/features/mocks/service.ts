import { db } from "@/db";
import { and, eq } from "drizzle-orm";
import { ServerActionError } from "@/features/shared/actions/error";
import { supabaseStorageClient } from "@/features/shared/storage-service";
import { generateUUIDv7 } from "@/features/shared/utils";
import { chapters } from "@/db/schemas/questions/chapters";
import { sections } from "@/db/schemas/questions/sections";
import { subjects } from "@/db/schemas/questions/subjects";
import { questions } from "@/db/schemas/questions/questions";
import {
  CreateMockTestCommand,
  CreateMockTestQuestionItemCommand,
} from "./dto/commands";
import { CreateMockTestFromDocumentsPayload } from "./dto/payloads";
import {
  DocumentOptionForMockProjection,
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
} from "./dto/results";
import { mockTestsRepository } from "./repositories/mock-tests.repository";

export class MockTestsService {
  /**
   * Retrieves all documents with their question counts so admin can pick documents to assemble a test.
   */
  async getDocumentsForMockCreation(): Promise<DocumentOptionForMockProjection[]> {
    return await mockTestsRepository.findDocumentsWithQuestionsCount(db);
  }

  /**
   * Creates a new mock test directly from selected documents.
   * Pulls all questions associated with the chosen documents and links them in sequence.
   */
  async createFromDocuments(
    userId: string,
    payload: CreateMockTestFromDocumentsPayload,
  ): Promise<CreateMockTestResult> {
    const trimmedName = payload.name?.trim();
    if (!trimmedName) {
      throw new ServerActionError(
        "INVALID_ARGUMENT",
        "Mock test name is required.",
      );
    }

    if (!payload.documentIds || payload.documentIds.length === 0) {
      throw new ServerActionError(
        "INVALID_ARGUMENT",
        "Please select at least one document to generate the mock test from.",
      );
    }

    const durationMinutes = payload.durationMinutes > 0 ? payload.durationMinutes : 60;
    const durationSeconds = durationMinutes * 60;
    const negativePercent = Math.max(
      0,
      Math.min(100, Math.round(payload.negativePercentagePerQuestion || 0)),
    );

    // Fetch all questions originating from the selected documents
    const matchedQuestions = await mockTestsRepository.findQuestionsByDocumentIds(
      db,
      payload.documentIds,
    );

    if (matchedQuestions.length === 0) {
      throw new ServerActionError(
        "INVALID_ARGUMENT",
        "No questions found in the selected document(s). Please make sure the documents have extracted questions.",
      );
    }

    const totalMarks =
      payload.customTotalMarks && payload.customTotalMarks > 0
        ? payload.customTotalMarks
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
      await mockTestsRepository.createMockTestQuestions(tx, questionItemsCommand);
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
   * Retrieves all mock tests with stats for admin view.
   */
  async getAllMockTests(options?: {
    search?: string;
  }): Promise<MockTestListItemProjection[]> {
    return await mockTestsRepository.findAll(db, options);
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
    // Check if there's already an in-progress attempt
    const existingAttempt = await mockTestsRepository.findInProgressAttempt(
      db,
      userId,
      mockTestId,
    );

    let attempt = existingAttempt;

    if (!attempt) {
      // Create new attempt
      const attemptId = generateUUIDv7();
      await mockTestsRepository.createAttempt(db, {
        id: attemptId,
        userId,
        mockTestId,
      });

      attempt = await mockTestsRepository.findAttemptById(db, attemptId);
      if (!attempt) {
        throw new ServerActionError(
          "INTERNAL_ERROR",
          "Failed to create mock test attempt.",
        );
      }
    }

    // Load questions with passages
    const questions = await mockTestsRepository.findAttemptQuestions(
      db,
      mockTestId,
    );
    await this.signAttemptQuestionDiagrams(questions);

    // Load previously saved answers so a resumed attempt keeps its state
    const answers = await mockTestsRepository.findAttemptAnswers(db, attempt.id);

    // Get mock test metadata for instructions
    const mockTest = await mockTestsRepository.findById(db, mockTestId);
    if (!mockTest) {
      throw new ServerActionError(
        "NOT_FOUND",
        `Mock test with ID ${mockTestId} was not found.`,
      );
    }

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
        negativePercentagePerQuestion: mockTest.negativePercentagePerQuestion,
        instructions: mockTest.instructions,
      },
    };
  }

  /**
   * Gets questions for an existing attempt.
   */
  async getAttemptQuestions(
    attemptId: string,
    userId: string,
  ): Promise<GetAttemptQuestionsResult> {
    const attempt = await mockTestsRepository.findAttemptById(db, attemptId);
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

    const questions = await mockTestsRepository.findAttemptQuestions(
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
        if (question.questionDiagram && !question.questionDiagram.startsWith("http")) {
          question.questionDiagram =
            urlMap.get(question.questionDiagram) || question.questionDiagram;
        }
        if (question.solutionDiagram && !question.solutionDiagram.startsWith("http")) {
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
    const attempt = await mockTestsRepository.findAttemptById(db, attemptId);
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
    const answer = await mockTestsRepository.upsertAttemptAnswer(db, {
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
  async completeMockAttempt(
    userId: string,
    attemptId: string,
  ): Promise<void> {
    const attempt = await mockTestsRepository.findAttemptById(db, attemptId);
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

    await mockTestsRepository.completeAttempt(db, { attemptId });
  }

  /**
   * Gets an attempt with mock test metadata.
   */
  async getAttempt(
    userId: string,
    attemptId: string,
  ): Promise<GetAttemptResult> {
    const attempt = await mockTestsRepository.findAttemptById(db, attemptId);
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
   */
  async getMyAttemptHistory(userId: string): Promise<AttemptHistoryResult> {
    const attempts = await mockTestsRepository.findUserAttempts(db, userId);
    if (attempts.length === 0) return [];

    const answers = await mockTestsRepository.findAnswersForAttempts(
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
  ): Promise<{ attempt: MockTestAttemptProjection; mockTest: MockTestDetailsProjection }> {
    const attempt = await mockTestsRepository.findAttemptById(db, attemptId);
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
    const answerRows = await mockTestsRepository.findAnswersForAttempts(db, [
      attempt.id,
    ]);

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
      else if (selected === question.correctOption.toUpperCase()) status = "correct";
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
      negativePercent > 0 ? Math.round(record.marks * negativePercent) / 100 : 0;

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
    const attempt = await mockTestsRepository.findAttemptById(db, attemptId);
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
