"use server";

import { requireSession } from "@/features/shared/actions/require-session";
import { documentsService } from "../service";
import { HeartbeatUploadSessionActionPayload } from "../dto/payloads";
import { HeartbeatUploadSessionActionResponse } from "../dto/results";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";

export async function heartbeatUploadSessionAction(
  payload: HeartbeatUploadSessionActionPayload,
): Promise<ServerActionResult<HeartbeatUploadSessionActionResponse>> {
  try {
    const session = await requireSession();

    const data = await documentsService.heartbeatUploadSession(
      session.user.id,
      payload,
    );

    return {
      success: true,
      data: data,
    };
  } catch (error) {
    return handleActionError(error);
  }
}
