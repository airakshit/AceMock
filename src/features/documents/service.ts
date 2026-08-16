import { db } from "@/db";
import { CreateNewDocumentPayload } from "./types";
import { documentsRepository } from "./repositories/documents.repository";
import { documentFilesRepository } from "./repositories/document-files.repository";
import { DocumentFileTypeEnum } from "./types";
import { documentFileTypeEnum } from "@/db/schemas";

class DocumentsService {
    async createNewDocumentTransaction(payload: CreateNewDocumentPayload) {
        await db.transaction(async (tx) => {
            const newDoc = await documentsRepository.create(tx, {
                userId: payload.userId,
                title: payload.title,
                description: payload.description,
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
                            storagePath: "",
                        };
                    }),
                    ...payload.images.map((value, _) => {
                        return {
                            originalFilename: value.name,
                            mimeType: value.type,
                            fileType: documentFileTypeEnum.enumValues[1],
                            fileSize: value.size,
                            storagePath: "",
                        };
                    }),
                ],
            );
        });
    }
}
