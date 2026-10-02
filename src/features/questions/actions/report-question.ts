"use server";

import { requireSession } from "@/features/shared/actions/require-session";
import { questionsService } from "../service";
import { CreateQuestionReportPayloadCommand } from "../dto/payloads";
import { CreateQuestionReportResult } from "../dto/results";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";

/**
 * Reports a question for the signed-in user under a predefined category.
 * Idempotent per category — reporting the same reason twice is a no-op.
 */
export async function reportQuestionAction(
  payload: CreateQuestionReportPayloadCommand,
): Promise<ServerActionResult<CreateQuestionReportResult>> {
  try {
    const session = await requireSession();

    const data = await questionsService.reportQuestion(
      session.user.id,
      payload,
    );

    return {
      success: true,
      data,
      message: data.alreadyReported
        ? "You already reported this issue for this question."
        : "Report submitted. Thank you!",
    };
  } catch (error) {
    return handleActionError(error);
  }
}
