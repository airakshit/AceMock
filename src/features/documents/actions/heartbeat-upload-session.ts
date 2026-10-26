"use server";

import { requireSession } from "@/features/shared/actions/require-session";
import { documentsService } from "../service";
import {
  HeartbeatUploadSessionActionPayload,
  HeartbeatUploadSessionActionResponse,
} from "./types";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";

/**
 * Client liveness ping (every 25s while the upload coordinator runs inside
 * its Web Lock). Keeps the session out of the stale/interrupted state and
 * carries an optional per-file progress snapshot for observability.
 */
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
