"use server";

import { requireSession } from "@/features/shared/actions/require-session";
import { documentsService } from "../service";
import {
  CancelUploadSessionActionPayload,
  CancelUploadSessionActionResponse,
} from "./types";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";

/**
 * Explicit user cancellation — a terminal, idempotent transition. Partial
 * TUS resources of in-flight files are cleaned up best-effort; the
 * session can never be revived afterwards.
 */
export async function cancelUploadSessionAction(
  payload: CancelUploadSessionActionPayload,
): Promise<ServerActionResult<CancelUploadSessionActionResponse>> {
  try {
    const session = await requireSession();

    const data = await documentsService.cancelUploadSession(
      session.user.id,
      payload,
    );

    return {
      success: true,
      data: data,
      message: "Upload session cancelled.",
    };
  } catch (error) {
    return handleActionError(error);
  }
}
