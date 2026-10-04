"use server";

import { handleActionError } from "@/features/shared/actions/error";
import { requireSession } from "@/features/shared/actions/require-session";
import { ServerActionResult } from "@/features/shared/actions/types";
import { AttemptHistoryResult } from "../dto/results";
import { mockTestsService } from "../service";

/**
 * Returns every attempt made by the current user with its score summary
 * (attempted / unattempted / correct / incorrect, earned marks, accuracy).
 */
export async function getMyAttemptHistoryAction(): Promise<
  ServerActionResult<AttemptHistoryResult>
> {
  try {
    const session = await requireSession();

    const data = await mockTestsService.getMyAttemptHistory(session.user.id);

    return {
      success: true,
      data,
    };
  } catch (error) {
    return handleActionError(error);
  }
}
