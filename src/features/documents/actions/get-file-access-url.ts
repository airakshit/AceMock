"use server";

import { requireSession } from "@/features/shared/actions/require-session";
import { documentsService } from "../service";
import {
  GetDocumentFileAccessUrlActionPayload,
  GetDocumentFileAccessUrlActionResponse,
} from "./types";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";

export async function getDocumentFileAccessUrlAction(
  payload: GetDocumentFileAccessUrlActionPayload,
): Promise<ServerActionResult<GetDocumentFileAccessUrlActionResponse>> {
  try {
    const session = await requireSession();

    const data = await documentsService.getDocumentFileAccessUrl(
      session.user.id,
      payload.documentId,
      payload.fileId,
    );

    return {
      success: true,
      data: data,
    };
  } catch (error) {
    return handleActionError(error);
  }
}
