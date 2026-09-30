"use server";

import { requireAdmin } from "@/features/shared/actions/require-admin";
import { questionsService } from "../service";
import { CreateQuestionPayloadCommand } from "../dto/payloads";
import { CreateQuestionResult, } from "../dto/results";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";

export async function createQuestionAction(
  payload: CreateQuestionPayloadCommand,
): Promise<ServerActionResult<CreateQuestionResult>> {
  try {
    const session = await requireAdmin();

    const data = await questionsService.createNewQuestion(
      session.user.id,
      payload,
    );

    return {
      success: true,
      data,
      message: "Question created successfully.",
    };
  } catch (error) {
    return handleActionError(error);
  }
}
