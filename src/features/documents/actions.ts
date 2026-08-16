"use server";

import { requireSession } from "../shared/require-session";
import { documentsService } from "./service";
import {
    CreateNewDocumentActionPayload,
    CreateNewDocumentActionResponse,
} from "./types";

export async function createNewDocumentAction(
    payload: CreateNewDocumentActionPayload,
): Promise<CreateNewDocumentActionResponse> {
    const session = await requireSession();

    return documentsService.createNewDocument(session.user.id, {
        ...payload,
    });
}
