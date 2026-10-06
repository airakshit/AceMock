"use server";

import { requireAdmin } from "@/features/shared/actions/require-admin";
import { questionsService } from "../service";
import { QuestionReportsSummaryResult } from "../dto/results";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";

/**
 * Loads the global report summary that heads the admin reports page:
 * totals plus `reportType → question_count` for every report category
 * (alongside the raw report-row count for the same category).
 *
 * All-time and unfiltered — it describes the whole backlog, while the
 * list underneath carries its own filter window. Every enum value is
 * present and zero-filled.
 */
export async function getQuestionReportsSummaryAction(): Promise<
  ServerActionResult<QuestionReportsSummaryResult>
> {
  try {
    await requireAdmin();

    const data = await questionsService.getQuestionReportsSummary();

    return {
      success: true,
      data,
      message: "Loaded question report summary.",
    };
  } catch (error) {
    return handleActionError(error);
  }
}
