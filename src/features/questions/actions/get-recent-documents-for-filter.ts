"use server";

import { requireAdmin } from "@/features/shared/actions/require-admin";
import { questionsService } from "../service";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";
import { GetRecentDocumentsResult } from "../dto/results";

export async function getRecentDocumentsForFilterAction(): Promise<
  ServerActionResult<GetRecentDocumentsResult>
> {
  try {
    await requireAdmin();
    const documents = await questionsService.getRecentDocumentsForFilter(30);

    return {
      success: true,
      data: {
        documents,
      },
      message: `Fetched ${documents.length} documents successfully.`,
    };
  } catch (error) {
    return handleActionError(error);
  }
}
