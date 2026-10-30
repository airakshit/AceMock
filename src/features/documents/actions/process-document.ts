"use server";

import { requireSession } from "@/features/shared/actions/require-session";
import { documentsService } from "../service";
import { ProcessDocumentActionPayload } from "../dto/payloads";
import { ProcessDocumentActionResponse } from "../dto/results";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";

export async function processDocumentAction(
  payload: ProcessDocumentActionPayload,
): Promise<ServerActionResult<ProcessDocumentActionResponse>> {
  try {
    const session = await requireSession();

    const data = await documentsService.processDocument(
      session.user.id,
      payload.documentId,
    );

    return {
      success: true,
      data: data,
      message: "Document processing started.",
    };
  } catch (error) {
    return handleActionError(error);
  }
}
