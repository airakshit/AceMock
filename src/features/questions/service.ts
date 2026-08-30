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
}

export const questionsService = new QuestionsService();
