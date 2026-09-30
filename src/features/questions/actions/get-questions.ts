"use server";

import { requireAdmin } from "@/features/shared/actions/require-admin";
import { questionsService } from "../service";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";
import { GetRecentQuestionsResult } from "../dto/results";

export async function getRecentQuestionsAction(
  limitOrParams: number | { limit?: number; documentId?: string } = 50,
  legacyDocId?: string,
): Promise<ServerActionResult<GetRecentQuestionsResult>> {
  try {
    await requireAdmin();

    let limit = 50;
    let documentId: string | undefined = undefined;

    if (typeof limitOrParams === "number") {
      limit = limitOrParams;
      documentId = legacyDocId?.trim() || undefined;
    } else if (limitOrParams && typeof limitOrParams === "object") {
      limit = limitOrParams.limit ?? 50;
      documentId = limitOrParams.documentId?.trim() || undefined;
    }

    const questions = await questionsService.getRecentQuestions(limit, documentId);
    const documentTitle = questions.length > 0 ? questions[0].documentTitle : null;

    return {
      success: true,
      data: {
        questions,
      },
      message: `Fetched ${questions.length} questions successfully.`,
    };
  } catch (error) {
    return handleActionError(error);
  }
}

