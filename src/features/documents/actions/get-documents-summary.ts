"use server";

import { requireSession } from "@/features/shared/actions/require-session";
import { documentsService } from "../service";
import { GetDocumentsSummaryActionResponse } from "../dto/results";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";

/**
 * Documents owned by the signed-in user, each with its question count.
 *
 * Shared picker for mock-test creation: the admin dashboard lists the
 * admin's documents, a student lists their own — the same code path, scoped
 * by the session.
 */
export async function getDocumentsSummaryAction(): Promise<
  ServerActionResult<GetDocumentsSummaryActionResponse>
> {
  try {
    const session = await requireSession();

    const data = await documentsService.getDocumentsSummary(session.user.id);

    return {
      success: true,
      data,
      message: "Documents retrieved successfully",
    };
  } catch (error) {
    return handleActionError(error);
  }
}
