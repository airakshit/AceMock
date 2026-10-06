"use server";

import { requireAdmin } from "@/features/shared/actions/require-admin";
import { questionsService } from "../service";
import { SearchReportedQuestionsPayloadCommand } from "../dto/payloads";
import { SearchReportedQuestionsResult } from "../dto/results";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";

/**
 * Loads one cursor-paginated page of reported questions for admin triage.
 * Pass `cursor` from the previous page's result to continue; omit it for
 * the first page. Never uses limit/offset.
 *
 * Each row is a *question* with its matching reports rolled up (category,
 * count, latest detail), filtered by `reportType` and/or the inclusive
 * `dateFrom`–`dateTo` window. Always carries the correct option and
 * solution so the reported answer can be inspected — admin-gated.
 */
export async function searchReportedQuestionsAction(
  payload: SearchReportedQuestionsPayloadCommand = {},
): Promise<ServerActionResult<SearchReportedQuestionsResult>> {
  try {
    await requireAdmin();

    const data = await questionsService.searchReportedQuestions(payload);

    return {
      success: true,
      data,
      message: `Fetched ${data.questions.length} reported questions.`,
    };
  } catch (error) {
    return handleActionError(error);
  }
}
