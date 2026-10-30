"use server";

import { requireSession } from "@/features/shared/actions/require-session";
import { documentsService } from "../service";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";
import { ResumeDocumentUploadActionPayload } from "../dto/payloads";
import { ResumeDocumentUploadActionResponse } from "../dto/results";

/**
 * THE server-side recovery decision point (plan §11).
 *
 * Called only by the explicit "Resume upload" button. The server runs the
 * recovery decision table — including live HEAD probes of stored TUS
 * resources with re-minted tokens — and returns a per-file plan
 * (resume / reupload / verify-commit / skip) that the client executes
 * mechanically. Uppy fingerprints are never trusted for any of this.
 */
export async function resumeDocumentUploadAction(
  payload: ResumeDocumentUploadActionPayload,
): Promise<ServerActionResult<ResumeDocumentUploadActionResponse>> {
  try {
    const session = await requireSession();

    const data = await documentsService.resumeDocumentUpload(
      session.user.id,
      payload,
    );

    return {
      success: true,
      data: data,
      message: data.canResume
        ? "Upload session recovered."
        : "This upload can no longer be resumed.",
    };
  } catch (error) {
    return handleActionError(error);
  }
}
