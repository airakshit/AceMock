import { documentFiles, documentPages, documents } from "@/db/schemas";
import { and, asc, eq } from "drizzle-orm";
import { DbExecutor } from "../../shared/types";

export class DocumentQueries {
  async getDocumentWithFiles(
    db: DbExecutor,
    documentId: string,
    userId: string,
  ) {
    const result = await db
      .select({
        document: documents,
        file: documentFiles,
      })
      .from(documents)
      .leftJoin(documentFiles, eq(documentFiles.documentId, documents.id))
      .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));

    return result;
  }

  async getDocumentWithPages(
    db: DbExecutor,
    documentId: string,
    userId: string,
  ) {
    return db
      .select({
        document: documents,
        page: documentPages,
      })
      .from(documents)
      .leftJoin(documentFiles, eq(documentFiles.documentId, documents.id))
      .leftJoin(
        documentPages,
        eq(documentPages.documentFileId, documentFiles.id),
      )
      .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
      .orderBy(asc(documentPages.pageNumber));
  }

  async getDocumentFilesAndPages(
    db: DbExecutor,
    documentId: string,
    userId: string,
  ) {
    return db
      .select({
        document: documents,
        file: documentFiles,
        page: documentPages,
      })
      .from(documents)
      .leftJoin(documentFiles, eq(documentFiles.documentId, documents.id))
      .leftJoin(
        documentPages,
        eq(documentPages.documentFileId, documentFiles.id),
      )
      .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
      .orderBy(asc(documentFiles.createdAt), asc(documentPages.pageNumber));
  }
}

export const documentQueries = new DocumentQueries();
