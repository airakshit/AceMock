"use server";

import { requireSession } from "@/features/shared/actions/require-session";
import { documentsService } from "../service";
import { GetUserDocumentsActionResponse } from "./types";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";

export async function getUserDocumentsAction(): Promise<
  ServerActionResult<GetUserDocumentsActionResponse>
> {
  try {
    const session = await requireSession();
    const docs = await documentsService.getUserDocuments(session.user.id);

    return {
      success: true,
      data: docs,
      message: "Documents retrieved successfully",
    };
  } catch (error) {
    return handleActionError(error);
  }
}
