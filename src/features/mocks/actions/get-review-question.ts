"use server";

import { handleActionError } from "@/features/shared/actions/error";
import { requireSession } from "@/features/shared/actions/require-session";
import { ServerActionResult } from "@/features/shared/actions/types";
import { ReviewQuestionResult } from "../dto/results";
import { mockTestsService } from "../service";

/**
 * Returns a single question with full review data (correct answer,
 * user answer, marks awarded) for on-demand loading during review.
 */
export async function getReviewQuestionAction(
  attemptId: string,
  position: number,
): Promise<ServerActionResult<ReviewQuestionResult>> {
  try {
    const session = await requireSession();

    const data = await mockTestsService.getReviewQuestion(
      session.user.id,
      attemptId,
      position,
    );

    return {
      success: true,
      data,
    };
  } catch (error) {
    return handleActionError(error);
  }
}