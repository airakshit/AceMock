"use server";

import { requireSession } from "@/features/shared/actions/require-session";
import { questionsService } from "../service";
import { CreateQuestionBookmarkPayloadCommand } from "../dto/payloads";
import { CreateQuestionBookmarkResult } from "../dto/results";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";

/**
 * Bookmarks a question for the signed-in user.
 * Idempotent — bookmarking twice returns the existing bookmark.
 */
export async function createQuestionBookmarkAction(
  payload: CreateQuestionBookmarkPayloadCommand,
): Promise<ServerActionResult<CreateQuestionBookmarkResult>> {
  try {
    const session = await requireSession();

    const data = await questionsService.createQuestionBookmark(
      session.user.id,
      payload,
    );

    return {
      success: true,
      data,
      message: data.alreadyBookmarked
        ? "Question is already bookmarked."
        : "Question bookmarked.",
    };
  } catch (error) {
    return handleActionError(error);
  }
}
