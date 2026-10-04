"use server";

import { handleActionError } from "@/features/shared/actions/error";
import { requireSession } from "@/features/shared/actions/require-session";
import { ServerActionResult } from "@/features/shared/actions/types";
import { GetAttemptQuestionsResult } from "../dto/results";
import { mockTestsService } from "../service";

export async function getAttemptQuestionsAction(
  attemptId: string,
): Promise<ServerActionResult<GetAttemptQuestionsResult>> {
  try {
    const session = await requireSession();

    const data = await mockTestsService.getQuestionsForMockTestAttempt(
      attemptId,
      session.user.id,
    );

    return {
      success: true,
      data,
    };
  } catch (error) {
    return handleActionError(error);
  }
}
