import { documentFiles } from "@/db/schemas";
import { and, desc, eq } from "drizzle-orm";
import { generateUUIDv7 } from "../../shared/utils";
import { DbExecutor } from "../../shared/types";
import { DocumentFileStatusEnum, DocumentFileTypeEnum } from "../types";

export class DocumentFilesRepository {
    async create(
        db: DbExecutor,
        documentId: string,
        data: {
            originalFilename: string;
            mimeType: string;
            fileType: DocumentFileTypeEnum;
            fileSize: number;
            storageUrl: string;
        },
    ) {
        const fileId = generateUUIDv7();

        const [file] = await db
            .insert(documentFiles)
            .values({
                id: fileId,
                documentId,
                originalFilename: data.originalFilename,
                mimeType: data.mimeType,
                fileType: data.fileType,
                fileSize: data.fileSize,
                storageUrl: data.storageUrl,
            })
            .returning();

        return file;
    }

    async createMany(
        db: DbExecutor,
        documentId: string,
        files: Array<{
            originalFilename: string;
            mimeType: string;
            fileType: DocumentFileTypeEnum;
            fileSize: number;
            storageUrl: string;
        }>,
    ) {
        const values = files.map((file) => ({
            id: generateUUIDv7(),
            documentId,
            originalFilename: file.originalFilename,
            mimeType: file.mimeType,
            fileType: file.fileType,
            fileSize: file.fileSize,
            storageUrl: file.storageUrl,
        }));

        const createdFiles = await db
            .insert(documentFiles)
            .values(values)
            .returning();

        return createdFiles;
    }

    async findById(db: DbExecutor, fileId: string) {
        const [file] = await db
            .select()
            .from(documentFiles)
            .where(eq(documentFiles.id, fileId))
            .limit(1);

        return file;
    }

    async findByIdForDocument(
        db: DbExecutor,
        fileId: string,
        documentId: string,
    ) {
        const [file] = await db
            .select()
            .from(documentFiles)
            .where(
                and(
                    eq(documentFiles.id, fileId),
                    eq(documentFiles.documentId, documentId),
                ),
            )
            .limit(1);

        return file;
    }

    async findByDocument(db: DbExecutor, documentId: string) {
        return db
            .select()
            .from(documentFiles)
            .where(eq(documentFiles.documentId, documentId))
            .orderBy(desc(documentFiles.createdAt));
    }

    async update(
        db: DbExecutor,
        fileId: string,
        documentId: string,
        data: {
            originalFilename?: string;
            mimeType?: string;
            fileType?: DocumentFileTypeEnum;
            fileSize?: number;
            storageUrl?: string;
            status?: DocumentFileStatusEnum;
        },
    ) {
        const [file] = await db
            .update(documentFiles)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(documentFiles.id, fileId),
                    eq(documentFiles.documentId, documentId),
                ),
            )
            .returning();

        return file;
    }

    async delete(db: DbExecutor, fileId: string, documentId: string) {
        const [file] = await db
            .delete(documentFiles)
            .where(
                and(
                    eq(documentFiles.id, fileId),
                    eq(documentFiles.documentId, documentId),
                ),
            )
            .returning();

        return file;
    }
}

export const documentFilesRepository = new DocumentFilesRepository();
