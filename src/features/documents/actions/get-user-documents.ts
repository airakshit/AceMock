"use server";

import { requireSession } from "@/features/shared/actions/require-session";
import { documentsService } from "../service";
import {
  DocumentSearchQueryPayload,
} from "../dto/payloads";
import {
  DocumentSearchQueryResponse,
} from "../dto/results";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";

/**
 * The user's documents list. Payload is optional — an empty payload is
 * simply "everything, newest first"; filters and pagination ride
 * `documentsService.searchUserDocuments`.
 */
export async function getUserDocumentsAction(
  payload?: DocumentSearchQueryPayload,
): Promise<ServerActionResult<DocumentSearchQueryResponse>> {
  try {
    const session = await requireSession();
    const data = await documentsService.searchUserDocuments(
      session.user.id,
      payload ?? {},
    );

    return {
      success: true,
      data: data,
      message: "Documents retrieved successfully",
    };
  } catch (error) {
    return handleActionError(error);
  }
}
