"use server";

import { requireSession } from "@/features/shared/actions/require-session";
import { questionsService } from "../service";
import { RemoveQuestionBookmarkPayloadCommand } from "../dto/payloads";
import { RemoveQuestionBookmarkResult } from "../dto/results";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";

/**
 * Removes the signed-in user's bookmark for a question.
 * Idempotent — removing a non-existent bookmark succeeds with `removed: false`.
 */
export async function removeQuestionBookmarkAction(
  payload: RemoveQuestionBookmarkPayloadCommand,
): Promise<ServerActionResult<RemoveQuestionBookmarkResult>> {
  try {
    const session = await requireSession();

    const data = await questionsService.removeQuestionBookmark(
      session.user.id,
      payload,
    );

    return {
      success: true,
      data,
      message: data.removed
        ? "Bookmark removed."
        : "Question was not bookmarked.",
    };
  } catch (error) {
    return handleActionError(error);
  }
}
