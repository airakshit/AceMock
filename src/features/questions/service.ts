import { db } from "@/db";
import { CreateQuestionPayloadCommand } from "./dto/payloads";
import { CreateQuestionResult } from "./dto/results";
import {
  DocumentWithQuestionCountProjection,
  QuestionDetailsProjection,
} from "./dto/projections";
import { questionsRepository } from "./repositories/questions.repository";
import { storagePaths } from "@/lib/supabase/storage-paths";
import { generateUUIDv7 } from "../shared/utils";
import { supabaseStorageClient } from "@/features/shared/storage-service";
import { ServerActionError } from "../shared/actions/error";


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
}

export const questionsService = new QuestionsService();
