"use server";

import { requireSession } from "@/features/shared/actions/require-session";
import { documentsService } from "../service";
import {
  DeleteDocumentFileActionPayload,
  DeleteDocumentFileActionResponse,
} from "./types";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";

export async function deleteDocumentFileAction(
  payload: DeleteDocumentFileActionPayload,
): Promise<ServerActionResult<DeleteDocumentFileActionResponse>> {
  try {
    const session = await requireSession();

    const data = await documentsService.deleteDocumentFile(
      session.user.id,
      payload.documentId,
      payload.fileId,
    );

    return {
      success: true,
      data: data,
      message: "File deleted successfully.",
    };
  } catch (error) {
    return handleActionError(error);
  }
}
