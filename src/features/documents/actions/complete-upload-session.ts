"use server";

import { requireSession } from "@/features/shared/actions/require-session";
import { documentsService } from "../service";
import { CompleteUploadSessionActionPayload } from "../dto/payloads";
import { CompleteUploadSessionActionResponse } from "../dto/results";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";

/**
 * Commits the upload attempt: runs server-side storage verification of
 * every uploaded file, flips session → completed (terminal) only when
 * everything checks out, and reports any files that could not be
 * reconciled so the client can take the re-upload path.
 */
export async function completeUploadSessionAction(
  payload: CompleteUploadSessionActionPayload,
): Promise<ServerActionResult<CompleteUploadSessionActionResponse>> {
  try {
    const session = await requireSession();

    const data = await documentsService.completeUploadSession(
      session.user.id,
      payload,
    );

    return {
      success: true,
      data: data,
      message:
        data.unreconciledFiles.length === 0
          ? "Upload session completed."
          : "Some files could not be reconciled and need re-upload.",
    };
  } catch (error) {
    return handleActionError(error);
  }
}
