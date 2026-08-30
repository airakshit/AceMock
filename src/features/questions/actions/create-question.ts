"use server";

import { requireSession } from "@/features/shared/actions/require-session";
import { questionsService } from "../service";
import {
  CreateQuestionActionPayload,
  CreateQuestionActionResponse,
} from "./types";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";

export async function createQuestionAction(
  payload: CreateQuestionActionPayload,
): Promise<ServerActionResult<CreateQuestionActionResponse>> {
  try {
    const session = await requireSession();

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
