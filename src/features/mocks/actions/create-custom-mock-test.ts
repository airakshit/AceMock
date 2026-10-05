"use server";

import { handleActionError } from "@/features/shared/actions/error";
import { requireSession } from "@/features/shared/actions/require-session";
import { ServerActionResult } from "@/features/shared/actions/types";
import { CreateCustomMockTestPayload } from "../dto/payloads";
import { CreateMockTestResult } from "../dto/results";
import { mockTestsService } from "../service";

/**
 * Lets a signed-in student build a custom mock test from their own uploaded
 * documents. Every question in the selected documents is included, and
 * `totalMarks` is derived server-side — it is not part of the payload.
 */
export async function createCustomMockTestAction(
  payload: CreateCustomMockTestPayload,
): Promise<ServerActionResult<CreateMockTestResult>> {
  try {
    const session = await requireSession();

    const data = await mockTestsService.createCustomMockTest(
      session.user.id,
      payload,
    );

    return {
      success: true,
      data,
      message: `Mock test "${data.name}" created with ${data.totalQuestions} questions.`,
    };
  } catch (error) {
    return handleActionError(error);
  }
}
