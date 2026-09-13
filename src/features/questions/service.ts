import { db } from "@/db";
import { CreateQuestionActionPayload, CreateQuestionActionResponse } from "./actions/types";
import { questionsRepository } from "./repositories/questions.repository";
import { storagePaths } from "@/lib/supabase/storage-paths";
import { generateUUIDv7 } from "../shared/utils";
import { supabaseStorageClient } from "@/features/shared/storage-service";
import { ServerActionError } from "../shared/actions/error";

class QuestionsService {
  async createNewQuestion(
    userId: string,
    payload: CreateQuestionActionPayload,
  ): Promise<CreateQuestionActionResponse> {
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
      diagram_url: diagramStoragePath,
      hint: payload.hint,
      solution: payload.solution,
      solution_diagram_url: solutionDiagramStoragePath,
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

  async getRecentQuestions(limit: number = 50) {
    const rawQuestions = await questionsRepository.findRecentWithCurriculum(
      db,
      limit,
    );

    // Collect paths to sign if they are storage paths
    const pathsToSign = new Set<string>();
    for (const q of rawQuestions) {
      if (
        q.diagram_url &&
        !q.diagram_url.startsWith("http") &&
        !q.diagram_url.startsWith("data:")
      ) {
        pathsToSign.add(q.diagram_url);
      }
      if (
        q.solution_diagram_url &&
        !q.solution_diagram_url.startsWith("http") &&
        !q.solution_diagram_url.startsWith("data:")
      ) {
        pathsToSign.add(q.solution_diagram_url);
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

    return rawQuestions.map((q) => {
      const diagramUrl = q.diagram_url
        ? urlMap.get(q.diagram_url) || q.diagram_url
        : null;
      const solutionDiagramUrl = q.solution_diagram_url
        ? urlMap.get(q.solution_diagram_url) || q.solution_diagram_url
        : null;

      const rawOptions = (
        Array.isArray(q.options) ? q.options : []
      ) as Array<{
        key?: string;
        content?: string;
        text?: string;
      }>;

      const formattedOptions = rawOptions.map((opt, idx) => {
        const keys = ["A", "B", "C", "D"] as const;
        const key = (opt.key || keys[idx] || "A") as "A" | "B" | "C" | "D";
        const content = opt.content || opt.text || "";
        return {
          key,
          content,
          isCorrect: key === q.correctOption,
        };
      });

      return {
        id: q.id,
        subject: (q.subjectSlug || "general").toLowerCase(),
        subjectName: q.subjectName || "General",
        sectionName: q.sectionName || null,
        chapterName: q.chapterName || null,
        questionText: q.question,
        options: formattedOptions,
        correctOption: (q.correctOption || "A") as "A" | "B" | "C" | "D",
        explanation: q.solution || undefined,
        hint: q.hint || undefined,
        marks: q.marks ?? 1,
        negativeMarks: 0,
        difficulty: q.difficulty,
        diagramUrl,
        solutionDiagramUrl,
        createdAt: q.createdAt ? q.createdAt.toISOString() : null,
        updatedAt: q.updatedAt ? q.updatedAt.toISOString() : null,
      };
    });
  }
}

export const questionsService = new QuestionsService();
