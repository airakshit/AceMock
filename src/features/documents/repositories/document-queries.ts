import { documentFiles, documents } from "@/db/schemas";
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
}

export const documentQueries = new DocumentQueries();
