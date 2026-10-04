import { db } from "@/db";
import {
  CreateQuestionBookmarkPayloadCommand,
  CreateQuestionPayloadCommand,
  CreateQuestionReportPayloadCommand,
  GetBookmarkedQuestionsPayloadCommand,
  GetQuestionSolutionPayloadCommand,
  RemoveQuestionBookmarkPayloadCommand,
} from "./dto/payloads";
import {
  CreateQuestionBookmarkResult,
  CreateQuestionReportResult,
  CreateQuestionResult,
  GetBookmarkedQuestionsResult,
  GetQuestionSolutionResult,
  RemoveQuestionBookmarkResult,
} from "./dto/results";
import {
  BookmarkedQuestionProjection,
  CurriculumOptionsProjection,
  DocumentWithQuestionCountProjection,
  QuestionDetailsProjection,
} from "./dto/projections";
import { questionsRepository } from "./repositories/questions.repository";
import { questionBookmarksRepository } from "./repositories/question-bookmarks.repository";
import { questionReportsRepository } from "./repositories/question-reports.repository";
import { OptionKey } from "../shared/components/question-card";
import { isQuestionReportType } from "../shared/components/question-card/types";
import { decodeBookmarkCursor, encodeBookmarkCursor } from "./utils";
import { storagePaths } from "@/lib/supabase/storage-paths";
import { generateUUIDv7, isValidUUID } from "../shared/utils";
import { supabaseStorageClient } from "@/features/shared/storage-service";
import { ServerActionError } from "../shared/actions/error";

const MAX_REPORT_DESCRIPTION_LENGTH = 2000;
const BOOKMARKS_PAGE_SIZE = 20;

class QuestionsService {
  async createNewQuestion(
    userId: string,
    payload: CreateQuestionPayloadCommand,
  ): Promise<CreateQuestionResult> {
    const chapter = await questionsRepository.findChapterBySlug(
      db,
      payload.chapterSlug,
    );

    if (!chapter) {
      throw new ServerActionError(
        "NOT_FOUND",
        `Chapter with slug "${payload.chapterSlug}" not found.`,
      );
    }

    const questionId = generateUUIDv7();

    const diagramFile = payload.files.find((f) => f.field === "diagram");
    const solutionDiagramFile = payload.files.find(
      (f) => f.field === "solution_diagram",
    );

    const diagramStoragePath = diagramFile
      ? storagePaths.getQuestionDiagramPath(
          userId,
          questionId,
          diagramFile.name,
        )
      : null;

    const solutionDiagramStoragePath = solutionDiagramFile
      ? storagePaths.getQuestionSolutionDiagramPath(
          userId,
          questionId,
          solutionDiagramFile.name,
        )
      : null;

    await questionsRepository.create(db, {
      id: questionId,
      chapterId: chapter.id,
      question: payload.question,
      options: payload.options,
      correctOption: payload.correctOption,
      marks: payload.marks,
      difficulty: payload.difficulty,
      questionDiagram: diagramStoragePath,
      hint: payload.hint,
      solution: payload.solution,
      solutionDiagram: solutionDiagramStoragePath,
    });

    // If there are files to upload, get signed upload URLs
    const filesToSign = payload.files.map((file) => {
      const storagePath =
        file.field === "diagram"
          ? diagramStoragePath!
          : solutionDiagramStoragePath!;

      return {
        clientFileId: file.clientFileId,
        serverFileId: file.clientFileId,
        storagePath,
      };
    });

    const signedUrls =
      filesToSign.length > 0
        ? await supabaseStorageClient.getUploadSignedUrls(filesToSign)
        : [];

    return {
      questionId,
      files: signedUrls,
    };
  }

  async getRecentQuestions(
    limit: number = 50,
    documentId?: string,
  ): Promise<QuestionDetailsProjection[]> {
    const rawQuestions = await questionsRepository.findRecentWithCurriculum(
      db,
      limit,
      documentId,
    );

    // Collect diagram paths so they can be signed in one batch
    const pathsToSign = new Set<string>();
    for (const q of rawQuestions) {
      if (q.questionDiagram) pathsToSign.add(q.questionDiagram);
      if (q.solutionDiagram) pathsToSign.add(q.solutionDiagram);
    }

    const urlMap = await this.signStoragePaths(pathsToSign);

    return rawQuestions.map((q): QuestionDetailsProjection => {
      const questionDiagram = q.questionDiagram
        ? urlMap.get(q.questionDiagram) || q.questionDiagram
        : null;
      const solutionDiagram = q.solutionDiagram
        ? urlMap.get(q.solutionDiagram) || q.solutionDiagram
        : null;

      return {
        ...q,
        questionDiagram,
        solutionDiagram,
      };
    });
  }

  async getRecentDocumentsForFilter(
    limit: number = 20,
  ): Promise<DocumentWithQuestionCountProjection[]> {
    return questionsRepository.findRecentDocumentsWithQuestions(db, limit);
  }

  /**
   * Whole curriculum for cascading subject → section → chapter pickers.
   */
  async getCurriculumOptions(): Promise<CurriculumOptionsProjection> {
    return questionsRepository.findCurriculumOptions(db);
  }

  /**
   * Bookmarks a question for the current user.
   * Idempotent: if the bookmark already exists it is returned unchanged.
   */
  async createQuestionBookmark(
    userId: string,
    payload: CreateQuestionBookmarkPayloadCommand,
  ): Promise<CreateQuestionBookmarkResult> {
    this.assertValidQuestionId(payload.questionId);

    const question = await questionsRepository.findById(db, payload.questionId);
    if (!question) {
      throw new ServerActionError("NOT_FOUND", "Question not found.");
    }

    const existing = await questionBookmarksRepository.findByUserAndQuestion(
      db,
      userId,
      payload.questionId,
    );

    if (existing) {
      return {
        bookmarkId: existing.id,
        questionId: existing.questionId,
        alreadyBookmarked: true,
      };
    }

    const bookmark = await questionBookmarksRepository.create(db, {
      id: generateUUIDv7(),
      userId,
      questionId: payload.questionId,
    });

    return {
      bookmarkId: bookmark.id,
      questionId: bookmark.questionId,
      alreadyBookmarked: false,
    };
  }

  /**
   * Removes the current user's bookmark for a question.
   * Idempotent: returns `removed: false` when there was nothing to remove.
   */
  async removeQuestionBookmark(
    userId: string,
    payload: RemoveQuestionBookmarkPayloadCommand,
  ): Promise<RemoveQuestionBookmarkResult> {
    this.assertValidQuestionId(payload.questionId);

    const removed = await questionBookmarksRepository.deleteByUserAndQuestion(
      db,
      userId,
      payload.questionId,
    );

    return { questionId: payload.questionId, removed };
  }

  /**
   * Records a report for a question under a predefined category.
   * Idempotent per (user, question, report type).
   */
  async reportQuestion(
    userId: string,
    payload: CreateQuestionReportPayloadCommand,
  ): Promise<CreateQuestionReportResult> {
    this.assertValidQuestionId(payload.questionId);

    if (!isQuestionReportType(payload.reportType)) {
      throw new ServerActionError(
        "BAD_REQUEST",
        `Invalid report type "${String(payload.reportType)}".`,
      );
    }

    const description =
      typeof payload.description === "string" ? payload.description.trim() : "";

    if (description.length > MAX_REPORT_DESCRIPTION_LENGTH) {
      throw new ServerActionError(
        "BAD_REQUEST",
        `Report description must be ${MAX_REPORT_DESCRIPTION_LENGTH} characters or less.`,
      );
    }

    const question = await questionsRepository.findById(db, payload.questionId);
    if (!question) {
      throw new ServerActionError("NOT_FOUND", "Question not found.");
    }

    const existing = await questionReportsRepository.findUserReport(
      db,
      userId,
      payload.questionId,
      payload.reportType,
    );

    if (existing) {
      return {
        reportId: existing.id,
        questionId: existing.questionId,
        reportType: existing.reportType,
        alreadyReported: true,
      };
    }

    const report = await questionReportsRepository.create(db, {
      id: generateUUIDv7(),
      userId,
      questionId: payload.questionId,
      reportType: payload.reportType,
      description: description || null,
    });

    return {
      reportId: report.id,
      questionId: report.questionId,
      reportType: report.reportType,
      alreadyReported: false,
    };
  }

  /** Rejects malformed ids before they reach Postgres. */
  private assertValidQuestionId(questionId: string): void {
    if (!questionId || !isValidUUID(questionId)) {
      throw new ServerActionError(
        "BAD_REQUEST",
        "A valid question id is required.",
      );
    }
  }

  /**
   * One cursor-paginated page of the user's bookmarked questions.
   * Ordered by bookmark time (newest first); never uses OFFSET.
   *
   * By default the page carries questions + options only; requesting
   * `includeSolution: true` additionally loads each question's correct
   * option, solution, and signed solution diagram.
   */
  async getBookmarkedQuestions(
    userId: string,
    payload: GetBookmarkedQuestionsPayloadCommand,
  ): Promise<GetBookmarkedQuestionsResult> {
    const cursor = payload.cursor ? decodeBookmarkCursor(payload.cursor) : null;
    const subjectSlug = payload.subjectSlug?.trim() || undefined;

    if (
      payload.includeSolution !== undefined &&
      typeof payload.includeSolution !== "boolean"
    ) {
      throw new ServerActionError(
        "BAD_REQUEST",
        `"includeSolution" must be a boolean, got ${typeof payload.includeSolution}.`,
      );
    }

    const includeSolution = payload.includeSolution === true;

    // Fetch one extra row to determine whether another page exists.
    const rows = await questionBookmarksRepository.findBookmarkedQuestions(db, {
      userId,
      cursor,
      subjectSlug,
      includeSolution,
      limit: BOOKMARKS_PAGE_SIZE + 1,
    });

    const hasMore = rows.length > BOOKMARKS_PAGE_SIZE;
    const page = hasMore ? rows.slice(0, BOOKMARKS_PAGE_SIZE) : rows;

    // Sign question diagrams always; solution diagrams only when they
    // will actually appear in the payload.
    const pathsToSign: string[] = [];
    for (const q of page) {
      if (q.questionDiagram) pathsToSign.push(q.questionDiagram);
      if (includeSolution && q.solutionDiagram)
        pathsToSign.push(q.solutionDiagram);
    }
    const urlMap = await this.signStoragePaths(pathsToSign);

    const questions = page.map((q): BookmarkedQuestionProjection => {
      const base: BookmarkedQuestionProjection = {
        bookmarkId: q.bookmarkId,
        bookmarkedAt: q.bookmarkedAt,
        id: q.id,
        question: q.question,
        options: q.options,
        marks: q.marks,
        difficulty: q.difficulty,
        questionDiagram: q.questionDiagram
          ? urlMap.get(q.questionDiagram) || q.questionDiagram
          : null,
        hasSolution: q.hasSolution,
        chapterName: q.chapterName,
        sectionName: q.sectionName,
        subjectName: q.subjectName,
        subjectSlug: q.subjectSlug,
      };

      if (!includeSolution) return base;

      return {
        ...base,
        correctOption: q.correctOption as OptionKey,
        solution: q.solution,
        solutionDiagramUrl: q.solutionDiagram
          ? urlMap.get(q.solutionDiagram) || q.solutionDiagram
          : null,
      };
    });

    const lastRow = page[page.length - 1];
    return {
      questions,
      hasMore,
      nextCursor:
        hasMore && lastRow
          ? encodeBookmarkCursor({
              bookmarkedAt: lastRow.bookmarkedAt,
              bookmarkId: lastRow.bookmarkId,
            })
          : null,
    };
  }

  /**
   * Reveals the correct option and solution for one question.
   * Gated: the question must belong to the user's bookmarks.
   */
  async getQuestionSolution(
    userId: string,
    payload: GetQuestionSolutionPayloadCommand,
  ): Promise<GetQuestionSolutionResult> {
    this.assertValidQuestionId(payload.questionId);

    const question = await questionsRepository.findById(db, payload.questionId);
    if (!question) {
      throw new ServerActionError("NOT_FOUND", "Question not found.");
    }

    const bookmark = await questionBookmarksRepository.findByUserAndQuestion(
      db,
      userId,
      payload.questionId,
    );
    if (!bookmark) {
      throw new ServerActionError(
        "NOT_FOUND",
        "Question not found in your bookmarks.",
      );
    }

    let solutionDiagramUrl: string | null = question.solutionDiagram;
    if (question.solutionDiagram) {
      const urlMap = await this.signStoragePaths([question.solutionDiagram]);
      solutionDiagramUrl =
        urlMap.get(question.solutionDiagram) ?? question.solutionDiagram;
    }

    return {
      questionId: question.id,
      correctOption: question.correctOption as OptionKey,
      solution: question.solution,
      solutionDiagramUrl,
    };
  }

  /**
   * Signs Supabase storage paths for page display. Raw http/data URLs are
   * skipped; signing failures degrade gracefully to the raw value.
   */
  private async signStoragePaths(
    paths: Iterable<string>,
  ): Promise<Map<string, string>> {
    const toSign = Array.from(paths).filter(
      (path) => path && !path.startsWith("http") && !path.startsWith("data:"),
    );

    const urlMap = new Map<string, string>();
    if (toSign.length === 0) return urlMap;

    try {
      const signedList = await supabaseStorageClient.getPageAccessUrls(
        toSign,
        3600,
      );
      for (const item of signedList) {
        urlMap.set(item.path, item.signedUrl);
      }
    } catch (err) {
      console.error("Failed to sign question diagram URLs:", err);
    }

    return urlMap;
  }
}

export const questionsService = new QuestionsService();
