"use server";

import { requireSession } from "@/features/shared/actions/require-session";
import { questionsService } from "../service";
import { GetQuestionSolutionPayloadCommand } from "../dto/payloads";
import { GetQuestionSolutionResult } from "../dto/results";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";

/**
 * Reveals the correct option and solution for a single question.
 * Gated server-side: the question must be bookmarked by the caller,
 * so mock/test flows never receive answers through this action.
 */
export async function getQuestionSolutionAction(
  payload: GetQuestionSolutionPayloadCommand,
): Promise<ServerActionResult<GetQuestionSolutionResult>> {
  try {
    const session = await requireSession();

    const data = await questionsService.getQuestionSolution(
      session.user.id,
      payload,
    );

    return {
      success: true,
      data,
      message: "Solution loaded.",
    };
  } catch (error) {
    return handleActionError(error);
  }
}
