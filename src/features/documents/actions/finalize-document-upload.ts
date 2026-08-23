"use server";

import { requireSession } from "@/features/shared/actions/require-session";
import { documentsService } from "../service";
import {
  FinalizeDocumentUploadActionResponse,
  FinalizeDocumentUploadActionPayload,
} from "./types";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";

export async function finalizeDocumentUploadAction(
  payload: FinalizeDocumentUploadActionPayload,
): Promise<ServerActionResult<FinalizeDocumentUploadActionResponse>> {
  try {
    const session = await requireSession();

    const data = await documentsService.finalizeDocumentUpload(
      session.user.id,
      payload,
    );

    return {
      success: true,
      data: data,
      message: "Marked as uploaded.",
    };
  } catch (error) {
    return handleActionError(error);
  }
}
