"use server";

import { requireSession } from "@/features/shared/actions/require-session";
import { questionsService } from "../service";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";

export type QuestionItemDTO = Awaited<
  ReturnType<typeof questionsService.getRecentQuestions>
>[number];

export interface GetRecentQuestionsActionResponse {
  questions: QuestionItemDTO[];
}

export async function getRecentQuestionsAction(
  limit: number = 50,
): Promise<ServerActionResult<GetRecentQuestionsActionResponse>> {
  try {
    // await requireSession();

    const questions = await questionsService.getRecentQuestions(limit);

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
