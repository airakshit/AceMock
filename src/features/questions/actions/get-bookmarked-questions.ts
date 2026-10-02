"use server";

import { requireSession } from "@/features/shared/actions/require-session";
import { questionsService } from "../service";
import { GetBookmarkedQuestionsPayloadCommand } from "../dto/payloads";
import { GetBookmarkedQuestionsResult } from "../dto/results";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";

/**
 * Loads one cursor-paginated page of the signed-in user's bookmarked
 * questions. Pass `cursor` from the previous page's result to continue;
 * omit it for the first page. Never uses limit/offset.
 *
 * By default the page contains questions and options only — the correct
 * option and solution are only included when `includeSolution` is `true`
 * (opt-in load toggle).
 */
export async function getBookmarkedQuestionsAction(
  payload: GetBookmarkedQuestionsPayloadCommand = {},
): Promise<ServerActionResult<GetBookmarkedQuestionsResult>> {
  try {
    const session = await requireSession();

    const data = await questionsService.getBookmarkedQuestions(
      session.user.id,
      payload,
    );

    return {
      success: true,
      data,
      message: `Fetched ${data.questions.length} bookmarked questions.`,
    };
  } catch (error) {
    return handleActionError(error);
  }
}
