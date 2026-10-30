"use server";

import { requireSession } from "@/features/shared/actions/require-session";
import { documentsService } from "../service";
import { UpdateDocumentActionPayload } from "../dto/payloads";
import { UpdateDocumentActionResponse } from "../dto/results";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";

export async function updateDocumentAction(
  payload: UpdateDocumentActionPayload,
): Promise<ServerActionResult<UpdateDocumentActionResponse>> {
  try {
    const session = await requireSession();

    const updatedDoc = await documentsService.updateDocument(
      session.user.id,
      payload.documentId,
      {
        title: payload.title,
        description: payload.description,
      },
    );

    return {
      success: true,
      data: { document: updatedDoc },
      message: "Document updated successfully.",
    };
  } catch (error) {
    return handleActionError(error);
  }
}
