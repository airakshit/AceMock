"use server";

import { handleActionError } from "@/features/shared/actions/error";
import { requireSession } from "@/features/shared/actions/require-session";
import { ServerActionResult } from "@/features/shared/actions/types";
import { SubmitAnswerPayload } from "../dto/payloads";
import { SubmitAnswerResult } from "../dto/results";
import { mockTestsService } from "../service";

export async function submitAttemptAnswerAction(
  payload: SubmitAnswerPayload,
): Promise<ServerActionResult<SubmitAnswerResult>> {
  try {
    const session = await requireSession();

    const data = await mockTestsService.submitAttemptAnswer(
      session.user.id,
      payload.attemptId,
      payload.questionId,
      payload.selectedOption,
    );

    return {
      success: true,
      data,
    };
  } catch (error) {
    return handleActionError(error);
  }
}