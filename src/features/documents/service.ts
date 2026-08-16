import { db } from "@/db";
import { CreateNewDocumentActionPayload } from "./types";
import { documentsRepository } from "./repositories/documents.repository";
import { documentFilesRepository } from "./repositories/document-files.repository";
import { documentFileTypeEnum } from "@/db/schemas";

class DocumentsService {
    async createNewDocument(
        userId: string,
        payload: CreateNewDocumentActionPayload,
    ) {
        const result = await db.transaction(async (tx) => {
            const newDoc = await documentsRepository.create(tx, {
                userId: userId,
                title: payload.title,
                description: payload.description,
                contentType: payload.contentType,
            });

            const files = await documentFilesRepository.createMany(
                tx,
                newDoc.id,
                [
                    ...payload.pdfs.map((value, _) => {
                        return {
                            originalFilename: value.name,
                            mimeType: value.type,
                            fileType: documentFileTypeEnum.enumValues[0],
                            fileSize: value.size,
                            storageUrl: "",
                        };
                    }),
                    ...payload.images.map((value, _) => {
                        return {
                            originalFilename: value.name,
                            mimeType: value.type,
                            fileType: documentFileTypeEnum.enumValues[1],
                            fileSize: value.size,
                            storageUrl: "",
                        };
                    }),
                ],
            );

            return {
                document: newDoc,
                files: files,
            };
        });

        return result;
    }
}

export const documentsService = new DocumentsService();
