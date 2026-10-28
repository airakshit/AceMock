"use server";

import { requireSession } from "@/features/shared/actions/require-session";
import { documentsService } from "../service";
import {
  GetUserDocumentActionPayload,
  GetUserDocumentActionResponse,
} from "./types";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";

/**
 * Single-document fetch — returns exactly the same DTO shape as
 * getUserDocumentsAction's items (DocumentItemDTO with files + relevant
 * session). Used for in-place refreshes of one document card.
 */
export async function getUserDocumentAction(
  payload: GetUserDocumentActionPayload,
): Promise<ServerActionResult<GetUserDocumentActionResponse>> {
  try {
    const session = await requireSession();

    const data = await documentsService.getUserDocument(
      session.user.id,
      payload.documentId,
    );

    return {
      success: true,
      data: data,
    };
  } catch (error) {
    return handleActionError(error);
  }
}
