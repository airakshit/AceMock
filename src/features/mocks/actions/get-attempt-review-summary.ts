"use server";

import { handleActionError } from "@/features/shared/actions/error";
import { requireSession } from "@/features/shared/actions/require-session";
import { ServerActionResult } from "@/features/shared/actions/types";
import { AttemptReviewSummaryResult } from "../dto/results";
import { mockTestsService } from "../service";

/**
 * Returns a lightweight summary of a completed attempt with a question
 * index (position + status) for the navigator.
 */
export async function getAttemptReviewSummaryAction(
  attemptId: string,
): Promise<ServerActionResult<AttemptReviewSummaryResult>> {
  try {
    const session = await requireSession();

    const data = await mockTestsService.getAttemptReviewSummary(
      session.user.id,
      attemptId,
    );

    return {
      success: true,
      data,
    };
  } catch (error) {
    return handleActionError(error);
  }
}