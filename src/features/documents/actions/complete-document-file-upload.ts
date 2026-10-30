"use server";

import { requireSession } from "@/features/shared/actions/require-session";
import { documentsService } from "../service";
import { CompleteDocumentFileUploadActionPayload } from "../dto/payloads";
import { CompleteDocumentFileUploadActionResponse } from "../dto/results";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";

/**
 * The client reports a single file's TUS transfer reached its final offset.
 * Idempotent: repeated calls for the same file are safe no-ops.
 */
export async function completeDocumentFileUploadAction(
  payload: CompleteDocumentFileUploadActionPayload,
): Promise<ServerActionResult<CompleteDocumentFileUploadActionResponse>> {
  try {
    const session = await requireSession();

    const data = await documentsService.completeDocumentFileUpload(
      session.user.id,
      payload,
    );

    return {
      success: true,
      data: data,
      message: "File upload recorded.",
    };
  } catch (error) {
    return handleActionError(error);
  }
}
