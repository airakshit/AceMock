"use server";

import { requireSession } from "@/features/shared/actions/require-session";
import { documentsService } from "../service";

import {
  CreateDocumentActionPayload,
  CreateDocumentActionResponse,
} from "./types";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";

/**
 * Creates the document + its first, server-owned upload session and returns
 * per-file signed TUS credentials. The client then executes the plan
 * returned here (see UploadFlow.md) — it never invents server state.
 */
export async function createDocumentAction(
  payload: CreateDocumentActionPayload,
): Promise<ServerActionResult<CreateDocumentActionResponse>> {
  try {
    const session = await requireSession();

    const data: CreateDocumentActionResponse =
      await documentsService.createDocument(session.user.id, {
        ...payload,
      });

    return {
      success: true,
      data: data,
      message: "Document created successfully. Uploading…",
    };
  } catch (error) {
    return handleActionError(error);
  }
}
