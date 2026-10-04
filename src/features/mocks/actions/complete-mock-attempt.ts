"use server";

import { handleActionError } from "@/features/shared/actions/error";
import { requireSession } from "@/features/shared/actions/require-session";
import { ServerActionResult } from "@/features/shared/actions/types";
import { CompleteAttemptPayload } from "../dto/payloads";
import { mockTestsService } from "../service";

export async function completeMockAttemptAction(
  payload: CompleteAttemptPayload,
): Promise<ServerActionResult<void>> {
  try {
    const session = await requireSession();

    await mockTestsService.completeMockAttempt(
      session.user.id,
      payload.attemptId,
    );

    return {
      success: true,
      data: undefined,
    };
  } catch (error) {
    return handleActionError(error);
  }
}