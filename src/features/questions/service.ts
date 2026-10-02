import { db } from "@/db";
import {
  CreateQuestionBookmarkPayloadCommand,
  CreateQuestionPayloadCommand,
  CreateQuestionReportPayloadCommand,
  RemoveQuestionBookmarkPayloadCommand,
} from "./dto/payloads";
import {
  CreateQuestionBookmarkResult,
  CreateQuestionReportResult,
  CreateQuestionResult,
  RemoveQuestionBookmarkResult,
} from "./dto/results";
import {
  DocumentWithQuestionCountProjection,
  QuestionDetailsProjection,
} from "./dto/projections";
import { questionsRepository } from "./repositories/questions.repository";
import { questionBookmarksRepository } from "./repositories/question-bookmarks.repository";
import { questionReportsRepository } from "./repositories/question-reports.repository";
import { isQuestionReportType } from "./types";
import { storagePaths } from "@/lib/supabase/storage-paths";
import { generateUUIDv7, isValidUUID } from "../shared/utils";
import { supabaseStorageClient } from "@/features/shared/storage-service";
import { ServerActionError } from "../shared/actions/error";

const MAX_REPORT_DESCRIPTION_LENGTH = 2000;


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

    // Collect paths to sign if they are storage paths
    const pathsToSign = new Set<string>();
    for (const q of rawQuestions) {
      if (
        q.questionDiagram &&
        !q.questionDiagram.startsWith("http") &&
        !q.questionDiagram.startsWith("data:")
      ) {
        pathsToSign.add(q.questionDiagram);
      }
      if (
        q.solutionDiagram &&
        !q.solutionDiagram.startsWith("http") &&
        !q.solutionDiagram.startsWith("data:")
      ) {
        pathsToSign.add(q.solutionDiagram);
      }
    }

    const urlMap = new Map<string, string>();
    if (pathsToSign.size > 0) {
      try {
        const signedList = await supabaseStorageClient.getPageAccessUrls(
          Array.from(pathsToSign),
          3600,
        );
        for (const item of signedList) {
          urlMap.set(item.path, item.signedUrl);
        }
      } catch (err) {
        console.error("Failed to sign question diagram URLs:", err);
      }
    }

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
    return questionsRepository.findRecentDocumentsWithQuestions(
      db,
      limit,
    );
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
}

export const questionsService = new QuestionsService();
