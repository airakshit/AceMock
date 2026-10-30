"use server";

import { requireSession } from "@/features/shared/actions/require-session";
import { documentsService } from "../service";
import { SaveUploadReferenceActionPayload } from "../dto/payloads";
import { SaveUploadReferenceActionResponse } from "../dto/results";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";

/**
 * Persists the TUS upload resource reference the client's TUS session
 * created for one file (pending → uploading). The server stores the
 * reference — NOT file bytes — so later recovery decisions are made from
 * server state alone.
 */
export async function saveUploadReferenceAction(
  payload: SaveUploadReferenceActionPayload,
): Promise<ServerActionResult<SaveUploadReferenceActionResponse>> {
  try {
    const session = await requireSession();

    const data = await documentsService.saveUploadReference(
      session.user.id,
      payload,
    );

    return {
      success: true,
      data: data,
      message: "Upload reference saved.",
    };
  } catch (error) {
    return handleActionError(error);
  }
}
