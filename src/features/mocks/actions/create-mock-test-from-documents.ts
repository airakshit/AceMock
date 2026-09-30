"use server";

import { handleActionError } from "@/features/shared/actions/error";
import { requireAdmin } from "@/features/shared/actions/require-admin";
import { ServerActionResult } from "@/features/shared/actions/types";
import { CreateMockTestFromDocumentsPayload } from "../dto/payloads";
import { CreateMockTestResult } from "../dto/results";
import { mockTestsService } from "../service";

export async function createMockTestFromDocumentsAction(
  payload: CreateMockTestFromDocumentsPayload,
): Promise<ServerActionResult<CreateMockTestResult>> {
  try {
    const session = await requireAdmin();

    const data = await mockTestsService.createFromDocuments(
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
