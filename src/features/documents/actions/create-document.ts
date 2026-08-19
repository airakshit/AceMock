"use server";

import { requireSession } from "@/features/shared/actions/require-session";
import { documentsService } from "../service";

import {
    CreateNewDocumentActionPayload,
    CreateNewDocumentActionResponse,
} from "./types";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";

export async function createNewDocumentAction(
    payload: CreateNewDocumentActionPayload,
): Promise<ServerActionResult<CreateNewDocumentActionResponse>> {
    try {
        const session = await requireSession();

        const data: CreateNewDocumentActionResponse =
            await documentsService.createNewDocument(session.user.id, {
                ...payload,
            });

        return {
            success: true,
            data: data,
            message: "Document Created Succcessfully. Uploading..",
        };
    } catch (error) {
        return handleActionError(error);
    }
}
