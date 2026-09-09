"use server";

import { requireSession } from "@/features/shared/actions/require-session";
import { documentsService } from "../service";
import {
  UpdateDocumentActionPayload,
  UpdateDocumentActionResponse,
} from "./types";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";

export async function updateDocumentAction(
  payload: UpdateDocumentActionPayload,
): Promise<ServerActionResult<UpdateDocumentActionResponse>> {
  try {
    const session = await requireSession();

    const data = await documentsService.updateDocument(
      session.user.id,
      payload.documentId,
      {
        title: payload.title,
        description: payload.description,
      },
    );

    return {
      success: true,
      data: data,
      message: "Document updated successfully.",
    };
  } catch (error) {
    return handleActionError(error);
  }
}
