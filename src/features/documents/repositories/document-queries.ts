import { documentFiles, documents, filePages, questions } from "@/db/schemas";
import { and, desc, eq, inArray, count } from "drizzle-orm";
import { DbExecutor } from "../../shared/types";
import {
  DocumentProjection,
  DocumentWithFilesProjection,
  DocumentWithQuestionCountProjection,
  DocumentFileProjection,
  FilePageProjection,
} from "../dto/projections";

export const documentFileColumns = {
  id: documentFiles.id,
  documentId: documentFiles.documentId,
  sessionId: documentFiles.sessionId,
  filename: documentFiles.filename,
  mimeType: documentFiles.mimeType,
  fileSize: documentFiles.fileSize,
  storagePath: documentFiles.storagePath,
  contentProbe: documentFiles.contentProbe,
  uploadRef: documentFiles.uploadRef,
  uploadRefCreatedAt: documentFiles.uploadRefCreatedAt,
  uploadStatus: documentFiles.uploadStatus,
  processingStatus: documentFiles.processingStatus,
  createdAt: documentFiles.createdAt,
};

export class DocumentQueries {
  async findById(
    db: DbExecutor,
    documentId: string,
  ): Promise<DocumentProjection | null> {
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    return document || null;
  }

  async findFileById(db: DbExecutor, fileId: string) {
    const [file] = (await db.select().from(documentFiles).where(eq(documentFiles.id, fileId)).limit(1))
    return file || null;
  }

  async findByIdForUser(
    db: DbExecutor,
    documentId: string,
    userId: string,
  ): Promise<DocumentProjection | null> {
    const [document] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
      .limit(1);

    return document || null;
  }

  async findByIdForUserWithFiles(
    db: DbExecutor,
    documentId: string,
    userId: string,
  ): Promise<DocumentWithFilesProjection | null> {
    const document = await this.findByIdForUser(db, documentId, userId);
    if (!document) return null;

    const files = await db
      .select(documentFileColumns)
      .from(documentFiles)
      .where(eq(documentFiles.documentId, documentId))
      .orderBy(desc(documentFiles.createdAt));

    const filesWithPages = await Promise.all(
      files.map(async (file) => {
        const pages = await db
          .select()
          .from(filePages)
          .where(eq(filePages.fileId, file.id))
          .orderBy(desc(filePages.createdAt));

        return {
          ...file,
          pages: pages as FilePageProjection[],
        };
      }),
    );

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
      files: filesWithPages,
    };
  }

  async findByUser(
    db: DbExecutor,
    userId: string,
  ): Promise<DocumentProjection[]> {
    return db
      .select()
      .from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(desc(documents.createdAt));
  }

  async findByUserWithFiles(
    db: DbExecutor,
    userId: string,
  ): Promise<DocumentWithFilesProjection[]> {
    const userDocs = await db
      .select()
      .from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(desc(documents.createdAt));

    if (userDocs.length === 0) return [];

    const docIds = userDocs.map((d) => d.id);
    const files = await db
      .select(documentFileColumns)
      .from(documentFiles)
      .where(inArray(documentFiles.documentId, docIds))
      .orderBy(desc(documentFiles.createdAt));

    /**
     * Group EVERY file under its document. The map is keyed by documentId
     * and holds an ARRAY — a single-object map here silently overwrote
     * entries per document, so each document surfaced only its last file
     * (wrong counts, missing files) until a per-document refresh ran.
     */
    const filesByDocument = new Map<
      string,
      Array<(typeof files)[number] & { pages: FilePageProjection[] }>
    >();
    for (const docId of docIds) {
      filesByDocument.set(docId, []);
    }

    const fileById = new Map<
      string,
      (typeof files)[number] & { pages: FilePageProjection[] }
    >();
    for (const file of files) {
      const entry = { ...file, pages: [] as FilePageProjection[] };
      filesByDocument.get(file.documentId)?.push(entry);
      fileById.set(file.id, entry);
    }

    // Fetch pages for all files in one pass (skip when there are none —
    // `inArray` with an empty list must not reach the DB).
    if (files.length > 0) {
      const fileIds = files.map((f) => f.id);
      const allPages = await db
        .select()
        .from(filePages)
        .where(inArray(filePages.fileId, fileIds))
        .orderBy(desc(filePages.createdAt));

      for (const page of allPages) {
        fileById.get(page.fileId)?.pages.push(page as FilePageProjection);
      }
    }

    return userDocs.map((doc) => ({
      id: doc.id,
      userId: doc.userId,
      title: doc.title,
      description: doc.description,
      processingStatus: doc.processingStatus,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      // Attached by the service layer (getRelevantSession), not per-query.
      session: null,
      files: filesByDocument.get(doc.id) ?? [],
    }));
  }

  async findFilesByDocumentId(
    db: DbExecutor,
    documentId: string,
  ): Promise<DocumentFileProjection[]> {
    const data = await db
      .select(documentFileColumns)
      .from(documents)
      .leftJoin(documentFiles, eq(documentFiles.documentId, documents.id))
      .where(eq(documents.id, documentId));

    return data as DocumentFileProjection[];
  }

  /**
   * Session-scoped file reads for the recovery algorithm.
   */
  async findFilesBySessionId(
    db: DbExecutor,
    sessionId: string,
  ): Promise<DocumentFileProjection[]> {
    return db
      .select(documentFileColumns)
      .from(documentFiles)
      .where(eq(documentFiles.sessionId, sessionId))
      .orderBy(desc(documentFiles.createdAt));
  }

  async findDocumentsWithQuestionsCount(
    db: DbExecutor,
  ): Promise<DocumentWithQuestionCountProjection[]> {
    const records = await db
      .select({
        id: documents.id,
        title: documents.title,
        createdAt: documents.createdAt,
        questionCount: count(questions.id),
      })
      .from(documents)
      .leftJoin(documentFiles, eq(documentFiles.documentId, documents.id))
      .leftJoin(questions, eq(questions.fileId, documentFiles.id))
      .groupBy(documents.id, documents.title, documents.createdAt)
      .orderBy(desc(documents.createdAt));

    return records.map((r) => ({
      id: r.id,
      title: r.title,
      createdAt: r.createdAt,
      questionCount: Number(r.questionCount || 0),
    }));
  }

  /**
   * Same summary as above, restricted to one user's documents.
   * Source for the mock-creation document picker (admin sees their own
   * documents, a student sees theirs).
   */
  async findDocumentsWithQuestionsCountForUser(
    db: DbExecutor,
    userId: string,
  ): Promise<DocumentWithQuestionCountProjection[]> {
    const records = await db
      .select({
        id: documents.id,
        title: documents.title,
        createdAt: documents.createdAt,
        questionCount: count(questions.id),
      })
      .from(documents)
      .leftJoin(documentFiles, eq(documentFiles.documentId, documents.id))
      .leftJoin(questions, eq(questions.fileId, documentFiles.id))
      .where(eq(documents.userId, userId))
      .groupBy(documents.id, documents.title, documents.createdAt)
      .orderBy(desc(documents.createdAt));

    return records.map((r) => ({
      id: r.id,
      title: r.title,
      createdAt: r.createdAt,
      questionCount: Number(r.questionCount || 0),
    }));
  }

  /**
   * Of the given ids, the subset that exists AND belongs to `userId`.
   * Lets a caller prove ownership of a client-supplied id list without
   * leaking whether an unowned id exists at all.
   */
  async findByIdsForUser(
    db: DbExecutor,
    userId: string,
    documentIds: string[],
  ): Promise<string[]> {
    if (documentIds.length === 0) return [];

    const rows = await db
      .select({ id: documents.id })
      .from(documents)
      .where(
        and(eq(documents.userId, userId), inArray(documents.id, documentIds)),
      );

    return rows.map((r) => r.id);
  }

  // Cross table queries
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

