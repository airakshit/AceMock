"use server";

import { requireSession } from "@/features/shared/actions/require-session";
import { documentsService } from "../service";
import {
  GetUserDocumentActionPayload,
} from "../dto/payloads";
import {
  GetUserDocumentActionResponse,
} from "../dto/results";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";

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
