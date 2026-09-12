"use server";

import { requireSession } from "@/features/shared/actions/require-session";
import { documentsService } from "../service";
import {
  GetDocumentStatusActionPayload,
  GetDocumentStatusActionResponse,
} from "./types";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";

export async function getDocumentStatusAction(
  payload: GetDocumentStatusActionPayload,
): Promise<ServerActionResult<GetDocumentStatusActionResponse>> {
  try {
    const session = await requireSession();

    const data = await documentsService.getDocumentStatus(
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
