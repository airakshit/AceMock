import { documents } from "@/db/schemas";
import { and, desc, eq } from "drizzle-orm";
import { generateUUIDv7 } from "../../shared/utils";
import { DbExecutor } from "../../shared/types";
import { DocumentContentType } from "../types";

export class DocumentsRepository {
    async create(
        db: DbExecutor,
        data: {
            userId: string;
            title: string;
            contentType: DocumentContentType;
            description?: string;
        },
    ) {
        const documentId = generateUUIDv7();

        const [document] = await db
            .insert(documents)
            .values({
                id: documentId,
                userId: data.userId,
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

    async update(
        db: DbExecutor,
        documentId: string,
        userId: string,
        data: {
            title?: string;
            description?: string;
            contentType?: DocumentContentType;
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
