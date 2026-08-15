import { documentPages } from "@/db/schemas";
import { and, asc, eq } from "drizzle-orm";
import { generateUUIDv7 } from "../../shared/utils";
import { DbExecutor } from "../../shared/types";

export class DocumentPagesRepository {
    async create(
        db: DbExecutor,
        documentId: string,
        documentFileId: string,
        pageNumber: number,
        data?: {
            imagePath?: string;
            extractedText?: string;
        },
    ) {
        const pageId = generateUUIDv7();

        const [page] = await db
            .insert(documentPages)
            .values({
                id: pageId,
                documentId,
                documentFileId,
                pageNumber,
                imagePath: data?.imagePath,
                extractedText: data?.extractedText,
            })
            .returning();

        return page;
    }

    async findById(
        db: DbExecutor,
        pageId: string,
    ) {
        const [page] = await db
            .select()
            .from(documentPages)
            .where(eq(documentPages.id, pageId))
            .limit(1);

        return page;
    }

    async findByIdForFile(
        db: DbExecutor,
        pageId: string,
        documentFileId: string,
    ) {
        const [page] = await db
            .select()
            .from(documentPages)
            .where(
                and(
                    eq(documentPages.id, pageId),
                    eq(documentPages.documentFileId, documentFileId),
                ),
            )
            .limit(1);

        return page;
    }

    async findByDocument(
        db: DbExecutor,
        documentId: string,
    ) {
        return db
            .select()
            .from(documentPages)
            .where(
                eq(documentPages.documentId, documentId),
            )
            .orderBy(asc(documentPages.pageNumber));
    }

    async findByFile(
        db: DbExecutor,
        documentFileId: string,
    ) {
        return db
            .select()
            .from(documentPages)
            .where(
                eq(documentPages.documentFileId, documentFileId),
            )
            .orderBy(asc(documentPages.pageNumber));
    }

    async update(
        db: DbExecutor,
        pageId: string,
        documentFileId: string,
        data: {
            pageNumber?: number;
            imagePath?: string;
            extractedText?: string;
        },
    ) {
        const [page] = await db
            .update(documentPages)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(documentPages.id, pageId),
                    eq(documentPages.documentFileId, documentFileId),
                ),
            )
            .returning();

        return page;
    }

    async delete(
        db: DbExecutor,
        pageId: string,
        documentFileId: string,
    ) {
        const [page] = await db
            .delete(documentPages)
            .where(
                and(
                    eq(documentPages.id, pageId),
                    eq(documentPages.documentFileId, documentFileId),
                ),
            )
            .returning();

        return page;
    }
}

export const documentPagesRepository =
    new DocumentPagesRepository();