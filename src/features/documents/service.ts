import { db } from "@/db";
import { CreateNewDocumentActionPayload } from "./actions/types";
import { documentsRepository } from "./repositories/documents.repository";
import { documentFilesRepository } from "./repositories/document-files.repository";
import { documentFileTypeEnum } from "@/db/schemas";
import { storagePaths } from "@/lib/supabase/storage-paths";
import { generateUUIDv7 } from "../shared/utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";

class DocumentsService {
    async createNewDocument(
        userId: string,
        payload: CreateNewDocumentActionPayload,
    ) {
        const documentId = generateUUIDv7();

        const pdfs = payload.pdfs.map((value) => {
            const documentFileId = generateUUIDv7();
            return {
                clientFileId: value.clientFileId,
                documentFileId: documentFileId,
                originalFilename: value.name,
                mimeType: value.type,
                fileType: documentFileTypeEnum.enumValues[0],
                fileSize: value.size,
                storageUrl: storagePaths.getDocumentFileSourceUrl(
                    userId,
                    documentId,
                    documentFileId,
                    value.name,
                ),
            };
        });
        const images = payload.images.map((value) => {
            const documentFileId = generateUUIDv7();
            return {
                clientFileId: value.clientFileId,
                originalFilename: value.name,
                mimeType: value.type,
                fileType: documentFileTypeEnum.enumValues[1],
                fileSize: value.size,
                storageUrl: storagePaths.getDocumentFileSourceUrl(
                    userId,
                    documentId,
                    documentFileId,
                    value.name,
                ),
            };
        });

        const result = await db.transaction(async (tx) => {
            const newDoc = await documentsRepository.create(tx, userId, {
                documentId: documentId,
                title: payload.title,
                description: payload.description,
                contentType: payload.contentType,
            });

            const files = await documentFilesRepository.createMany(
                tx,
                newDoc.id,
                [...pdfs, ...images],
            );
            return {
                document: newDoc,
                files: files,
            };
        });

        // Now, Continuing from step 6: Creating Signed urls.
        // const supabase = createSupabaseServerClient()
        // await supabase.storage.from("ace-mock").createSignedUploadUrl()

        return result;
    }
}

export const documentsService = new DocumentsService();
