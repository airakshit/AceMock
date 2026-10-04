"use server";

import { handleActionError } from "@/features/shared/actions/error";
import { requireSession } from "@/features/shared/actions/require-session";
import { ServerActionResult } from "@/features/shared/actions/types";
import { StartMockAttemptPayload } from "../dto/payloads";
import { StartMockAttemptResult } from "../dto/results";
import { mockTestsService } from "../service";

export async function startMockAttemptAction(
  payload: StartMockAttemptPayload,
): Promise<ServerActionResult<StartMockAttemptResult>> {
  try {
    const session = await requireSession();

    const data = await mockTestsService.startMockAttempt(
      session.user.id,
      payload.mockTestId,
    );

    return {
      success: true,
      data,
    };
  } catch (error) {
    return handleActionError(error);
  }
}