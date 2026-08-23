import { documents, documentFiles } from "@/db/schemas";
import { and, desc, eq, inArray } from "drizzle-orm";
import { generateUUIDv7 } from "../../shared/utils";
import { DbExecutor } from "../../shared/types";
import { DocumentContentType, DocumentStatus } from "../types";

export class DocumentsRepository {
    async create(
        db: DbExecutor,
        userId: string,
        data: {
            documentId: string;
            title: string;
            contentType: DocumentContentType;
            description?: string;
        },
    ) {
        const [document] = await db
            .insert(documents)
            .values({
                id: data.documentId,
                userId: userId,
                title: data.title,
                description: data.description,
                contentType: data.contentType,
            })
            .returning();

        return document;
    }

    async findById(db: DbExecutor, documentId: string) {
        const [document] = await db
            .select()
            .from(documents)
            .where(eq(documents.id, documentId))
            .limit(1);

        return document;
    }

    async findByIdForUser(db: DbExecutor, documentId: string, userId: string) {
        const [document] = await db
            .select()
            .from(documents)
            .where(
                and(eq(documents.id, documentId), eq(documents.userId, userId)),
            )
            .limit(1);

        return document;
    }

    async findByUser(db: DbExecutor, userId: string) {
        return db
            .select()
            .from(documents)
            .where(eq(documents.userId, userId))
            .orderBy(desc(documents.createdAt));
    }

    async findByUserWithFiles(db: DbExecutor, userId: string) {
        const userDocs = await db
            .select()
            .from(documents)
            .where(eq(documents.userId, userId))
            .orderBy(desc(documents.createdAt));

        if (userDocs.length === 0) return [];

        const docIds = userDocs.map((d) => d.id);
        const files = await db
            .select()
            .from(documentFiles)
            .where(inArray(documentFiles.documentId, docIds))
            .orderBy(desc(documentFiles.createdAt));

        const filesMap = new Map<string, typeof files>();
        for (const file of files) {
            const existing = filesMap.get(file.documentId) || [];
            existing.push(file);
            filesMap.set(file.documentId, existing);
        }

        return userDocs.map((doc) => ({
            ...doc,
            files: filesMap.get(doc.id) || [],
        }));
    }

    async update(
        db: DbExecutor,
        documentId: string,
        userId: string,
        data: {
            title?: string;
            description?: string;
            contentType?: DocumentContentType;
            status?: DocumentStatus;
        },
    ) {
        const [document] = await db
            .update(documents)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(
                and(eq(documents.id, documentId), eq(documents.userId, userId)),
            )
            .returning();

        return document;
    }

    async delete(db: DbExecutor, documentId: string, userId: string) {
        const [document] = await db
            .delete(documents)
            .where(
                and(eq(documents.id, documentId), eq(documents.userId, userId)),
            )
            .returning();

        return document;
    }
}

export const documentsRepository = new DocumentsRepository();
