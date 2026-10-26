"use server";

import { requireSession } from "@/features/shared/actions/require-session";
import { documentsService } from "../service";
import {
  GetUploadSessionStatusActionPayload,
  GetUploadSessionStatusActionResponse,
} from "./types";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";

/**
 * Read-only view of the document's relevant upload session (active one if
 * present, otherwise the most recent terminal session). Lets list views
 * derive live/interrupted/expired states without exposing per-file
 * bookkeeping.
 */
export async function getUploadSessionStatusAction(
  payload: GetUploadSessionStatusActionPayload,
): Promise<ServerActionResult<GetUploadSessionStatusActionResponse>> {
  try {
    const session = await requireSession();

    const data = await documentsService.getUploadSessionStatus(
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
