import { documentFiles, documents, filePages } from "@/db/schemas";
import { and, asc, eq } from "drizzle-orm";
import { DbExecutor } from "../../shared/types";
import {
  DocumentWithFilesProjection,
  DocumentFileProjection,
  FilePageProjection,
} from "../dto/projections";

export class DocumentQueries {
  async getDocumentWithFiles(
    db: DbExecutor,
    documentId: string,
    userId: string,
  ): Promise<DocumentWithFilesProjection | null> {
    const rows = await db
      .select({
        document: documents,
        file: documentFiles,
      })
      .from(documents)
      .leftJoin(documentFiles, eq(documentFiles.documentId, documents.id))
      .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));

    if (rows.length === 0) return null;

    const document = rows[0].document;
    const files = rows.filter((r) => r.file).map((r) => r.file!);

    return {
      id: document.id,
      userId: document.userId,
      title: document.title,
      description: document.description,
      processingStatus: document.processingStatus,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      // Attached by the service layer (getRelevantSession), not per-query.
      session: null,
      files: files.map((f) => ({ ...f, pages: [] as FilePageProjection[] })),
    };
  }

  async getDocumentWithPages(
    db: DbExecutor,
    documentId: string,
    userId: string,
  ): Promise<DocumentWithFilesProjection> {
    const rows = await db
      .select({
        documentId: documents.id,
        processingStatus: documents.processingStatus,
        fileId: documentFiles.id,
        fileName: documentFiles.filename,
        fileMimeType: documentFiles.mimeType,
        fileSize: documentFiles.fileSize,
        fileStoragePath: documentFiles.storagePath,
        fileUploadStatus: documentFiles.uploadStatus,
        fileProcessingStatus: documentFiles.processingStatus,
        fileSessionId: documentFiles.sessionId,
        fileContentProbe: documentFiles.contentProbe,
        fileUploadRef: documentFiles.uploadRef,
        fileUploadRefCreatedAt: documentFiles.uploadRefCreatedAt,
        fileCreatedAt: documentFiles.createdAt,
        page: filePages,
        userId: documents.userId,
        title: documents.title,
        description: documents.description,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .leftJoin(documentFiles, eq(documentFiles.documentId, documents.id))
      .leftJoin(filePages, eq(documentFiles.id, filePages.fileId))
      .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));

    const filesMap = new Map<
      string,
      DocumentFileProjection & { pages: FilePageProjection[] }
    >();

    for (const row of rows) {
      if (!row.fileId) continue;

      let file = filesMap.get(row.fileId);

      if (!file) {
        file = {
          id: row.fileId,
          documentId: row.documentId,
          filename: row.fileName as string,
          mimeType: row.fileMimeType ?? "",
          fileSize: row.fileSize ?? 0,
          storagePath: row.fileStoragePath ?? "",
          sessionId: row.fileSessionId ?? null,
          contentProbe: row.fileContentProbe ?? null,
          uploadRef: row.fileUploadRef ?? null,
          uploadRefCreatedAt: row.fileUploadRefCreatedAt ?? null,
          uploadStatus: row.fileUploadStatus ?? "uploading",
          processingStatus: row.fileProcessingStatus ?? "pending",
          createdAt: row.fileCreatedAt ?? new Date(),
          pages: [],
        };

        filesMap.set(row.fileId, file);
      }

      if (row.page) {
        file.pages.push(row.page as FilePageProjection);
      }
    }

    const result: DocumentWithFilesProjection = {
      id: documentId,
      userId: rows[0]?.userId || "",
      title: rows[0]?.title || "",
      description: rows[0]?.description || null,
      processingStatus: rows[0]?.processingStatus || "pending",
      createdAt: rows[0]?.createdAt || new Date(),
      updatedAt: rows[0]?.updatedAt || new Date(),
      // Attached by the service layer (getRelevantSession), not per-query.
      session: null,
      files: [...filesMap.values()],
    };
    return result;
  }
}

export const documentQueries = new DocumentQueries();
