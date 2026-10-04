"use server";

import { handleActionError } from "@/features/shared/actions/error";
import { requireSession } from "@/features/shared/actions/require-session";
import { ServerActionResult } from "@/features/shared/actions/types";
import { GetAttemptResult } from "../dto/results";
import { mockTestsService } from "../service";

export async function getAttemptAction(
  attemptId: string,
): Promise<ServerActionResult<GetAttemptResult>> {
  try {
    const session = await requireSession();

    const data = await mockTestsService.getAttempt(
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