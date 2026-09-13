import { documentFiles, documents, filePages } from "@/db/schemas";
import { and, asc, eq } from "drizzle-orm";
import { DbExecutor } from "../../shared/types";
import { FullDocumentResult } from "./types";

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
  ): Promise<FullDocumentResult> {
    const rows = await db
      .select({
        documentId: documents.id,
        processingStatus: documents.processingStatus,
        fileId: documentFiles.id,
        fileName: documentFiles.filename,
        page: filePages,
      })
      .from(documents)
      .leftJoin(documentFiles, eq(documentFiles.documentId, documents.id))
      .leftJoin(filePages, eq(documentFiles.id, filePages.fileId))
      .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));

    const filesMap = new Map<string, FullDocumentResult["files"][number]>();

    for (const row of rows) {
      if (!row.fileId) continue;

      let file = filesMap.get(row.fileId);

      if (!file) {
        file = {
          fileId: row.fileId,
          fileName: row.fileName as string,
          pages: [],
        };

        filesMap.set(row.fileId, file);
      }

      if (row.page) {
        file.pages.push(row.page);
      }
    }

    const result: FullDocumentResult = {
      documentId,
      processingStatus: rows[0]?.processingStatus || "pending",
      files: [...filesMap.values()],
    };
    return result;
  }
}

export const documentQueries = new DocumentQueries();
