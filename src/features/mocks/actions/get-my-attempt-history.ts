"use server";

import { handleActionError } from "@/features/shared/actions/error";
import { requireSession } from "@/features/shared/actions/require-session";
import { ServerActionResult } from "@/features/shared/actions/types";
import { AttemptHistoryResult } from "../dto/results";
import { mockTestsService } from "../service";

/**
 * Returns every attempt made by the current user with its score summary
 * (attempted / unattempted / correct / incorrect, earned marks, accuracy).
 * Pass `mockTestId` to narrow the list to a single test (history pop-up).
 */
export async function getMyAttemptHistoryAction(
  mockTestId?: string,
): Promise<ServerActionResult<AttemptHistoryResult>> {
  try {
    const session = await requireSession();

    const data = await mockTestsService.getMyAttemptHistory(
      session.user.id,
      mockTestId,
    );

    return {
      success: true,
      data,
    };
  } catch (error) {
    return handleActionError(error);
  }
}
