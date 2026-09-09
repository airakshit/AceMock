"use server";

import { requireSession } from "@/features/shared/actions/require-session";
import { documentsService } from "../service";
import {
  DeleteDocumentActionPayload,
  DeleteDocumentActionResponse,
} from "./types";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";

export async function deleteDocumentAction(
  payload: DeleteDocumentActionPayload,
): Promise<ServerActionResult<DeleteDocumentActionResponse>> {
  try {
    const session = await requireSession();

    const data = await documentsService.deleteDocument(
      session.user.id,
      payload.documentId,
    );

    return {
      success: true,
      data: data,
      message: "Document deleted successfully.",
    };
  } catch (error) {
    return handleActionError(error);
  }
}