import { documents, documentFiles, filePages, questions } from "@/db/schemas";
import { and, desc, eq, inArray, count } from "drizzle-orm";
import {
  DocumentProjection,
  DocumentWithFilesProjection,
  DocumentWithQuestionCountProjection,
  DocumentFileProjection,
  FilePageProjection,
} from "../dto/projections";
import {
  CreateDocumentCommand,
  CreateDocumentFileCommand,
  UpdateDocumentCommand,
  UpdateDocumentFileCommand,
  UpdateDocumentFileProcessingStatusCommand,
  DeleteDocumentCommand,
  DeleteDocumentFileCommand,
  CreateFilePageCommand,
  UpdateFilePageCommand,
  DeleteFilePageCommand,
  UpdateFilesUploadStatusCommand,
  SaveUploadReferenceCommand,
} from "../dto/commands";
import { DbExecutor } from "../../shared/types";
import { DocumentProcessingStatus, FileProcessingStatus, FilePageOCRStatus } from "../types";

/**
 * Shared column selection for document_files read models (repo-internal).
 * Upload bookkeeping (session_id / probe / TUS ref) is included because the
 * recovery + reconciliation paths consume the same projection.
 */
const documentFileColumns = {
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

export class DocumentsRepository {
  // ==================== COMMANDS (writes) ====================

  async create(
    db: DbExecutor,
    data: CreateDocumentCommand,
  ): Promise<DocumentProjection> {
    const [document] = await db
      .insert(documents)
      .values({
        id: data.documentId,
        userId: data.userId,
        title: data.title,
        description: data.description,
      })
      .returning();

    return document;
  }

  async createFile(
    db: DbExecutor,
    data: CreateDocumentFileCommand,
  ): Promise<DocumentFileProjection> {
    const [file] = await db
      .insert(documentFiles)
      .values({
        id: data.id,
        documentId: data.documentId,
        filename: data.filename,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        storagePath: data.storagePath,
      })
      .returning();

    return file;
  }

  async createManyFiles(
    db: DbExecutor,
    data: CreateDocumentFileCommand[],
  ): Promise<DocumentFileProjection[]> {
    if (data.length === 0) return [];

    const createdFiles = await db
      .insert(documentFiles)
      .values(
        data.map((file) => ({
          id: file.id,
          documentId: file.documentId,
          sessionId: file.sessionId,
          contentProbe: file.contentProbe,
          filename: file.filename,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
          storagePath: file.storagePath,
        })),
      )
      .returning();

    return createdFiles;
  }

  async createFilePage(
    db: DbExecutor,
    data: CreateFilePageCommand,
  ): Promise<FilePageProjection> {
    const [page] = await db
      .insert(filePages)
      .values({
        id: data.id,
        fileId: data.fileId,
        pageNo: data.pageNo,
      })
      .returning();

    return page;
  }

  async createManyFilePages(
    db: DbExecutor,
    data: CreateFilePageCommand[],
  ): Promise<FilePageProjection[]> {
    if (data.length === 0) return [];

    const values = data.map((page) => ({
      id: page.id,
      fileId: page.fileId,
      pageNo: page.pageNo,
    }));

    const createdPages = await db.insert(filePages).values(values).returning();

    return createdPages;
  }

  async update(
    db: DbExecutor,
    data: UpdateDocumentCommand,
  ): Promise<DocumentProjection | null> {
    const { documentId, userId, title, description, status } = data;

    const [document] = await db
      .update(documents)
      .set({
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { processingStatus: status }),
        updatedAt: new Date(),
      })
      .where(
        and(eq(documents.id, documentId), eq(documents.userId, userId)),
      )
      .returning();

    return document || null;
  }

  async updateFile(
    db: DbExecutor,
    data: UpdateDocumentFileCommand,
  ): Promise<DocumentFileProjection | null> {
    const [file] = await db
      .update(documentFiles)
      .set({
        ...data,
      })
      .where(
        and(
          eq(documentFiles.id, data.fileId),
          eq(documentFiles.documentId, data.documentId),
        ),
      )
      .returning();

    return file || null;
  }

  /**
   * Persists the TUS resource reference created by the client, transitioning
   * the file from `pending` to `uploading`. Idempotent for repeat saves.
   */
  async saveUploadReference(
    db: DbExecutor,
    data: SaveUploadReferenceCommand,
  ): Promise<DocumentFileProjection | null> {
    const [file] = await db
      .update(documentFiles)
      .set({
        uploadRef: data.uploadRef,
        uploadRefCreatedAt: new Date(),
        uploadStatus: "uploading",
      })
      .where(
        and(
          eq(documentFiles.id, data.fileId),
          eq(documentFiles.documentId, data.documentId),
          inArray(documentFiles.uploadStatus, ["pending", "uploading"]),
        ),
      )
      .returning();

    return file || null;
  }

  /**
   * Batch-flip uploadStatus for several files of one document.
   */
  async updateFilesUploadStatus(
    db: DbExecutor,
    data: UpdateFilesUploadStatusCommand,
  ): Promise<DocumentFileProjection[]> {
    if (data.fileIds.length === 0) return [];

    const files = await db
      .update(documentFiles)
      .set({
        uploadStatus: data.uploadStatus,
      })
      .where(
        and(
          eq(documentFiles.documentId, data.documentId),
          inArray(documentFiles.id, data.fileIds),
        ),
      )
      .returning();

    return files;
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

  /**
   * Storage-verification reconciliation: flip verified uploads to
   * `completed` in one shot; `uploadedToRelax` are files that FAILED
   * verification and must not be committed.
   */
  async reconcileVerifiedFiles(
    db: DbExecutor,
    data: {
      documentId: string;
      verifiedFileIds: string[];
      failedFileIds: string[];
    },
  ): Promise<DocumentFileProjection[]> {
    if (data.verifiedFileIds.length === 0 && data.failedFileIds.length === 0) {
      return [];
    }

    const verified =
      data.verifiedFileIds.length > 0
        ? await db
            .update(documentFiles)
            .set({ uploadStatus: "completed"})
            .where(
              and(
                eq(documentFiles.documentId, data.documentId),
                inArray(documentFiles.id, data.verifiedFileIds),
                eq(documentFiles.uploadStatus, "uploaded"),
              ),
            )
            .returning()
        : [];

    const failed =
      data.failedFileIds.length > 0
        ? await db
            .update(documentFiles)
            .set({ uploadStatus: "failed"})
            .where(
              and(
                eq(documentFiles.documentId, data.documentId),
                inArray(documentFiles.id, data.failedFileIds),
                eq(documentFiles.uploadStatus, "uploaded"),
              ),
            )
            .returning()
        : [];

    return [...verified, ...failed];
  }

  async updateFileProcessingStatus(
    db: DbExecutor,
    data: UpdateDocumentFileProcessingStatusCommand,
  ): Promise<DocumentFileProjection[]> {
    const files = await db
      .update(documentFiles)
      .set({
        processingStatus: data.status,
      })
      .where(eq(documentFiles.documentId, data.documentId))
      .returning();

    return files;
  }

  async updateFilePage(
    db: DbExecutor,
    data: UpdateFilePageCommand,
  ): Promise<FilePageProjection | null> {
    const { ocrModel, survivedValidation, ...rest } = data;

    const updateData = {
      ...rest,
      updatedAt: new Date(),
      ...(ocrModel !== undefined && { ocrModel }),
      ...(survivedValidation !== undefined && { survivedValidation }),
    };

    const [page] = await db
      .update(filePages)
      .set(updateData)
      .where(
        and(eq(filePages.id, data.pageId), eq(filePages.fileId, data.fileId)),
      )
      .returning();

    return page || null;
  }

  async updateFilePageStatus(
    db: DbExecutor,
    fileId: string,
    ocrStatus: FilePageOCRStatus,
  ): Promise<FilePageProjection[]> {
    const pages = await db
      .update(filePages)
      .set({
        ocrStatus,
        updatedAt: new Date(),
      })
      .where(eq(filePages.fileId, fileId))
      .returning();

    return pages;
  }

  async updateFilePageStatusByPageId(
    db: DbExecutor,
    pageId: string,
    ocrStatus: FilePageOCRStatus,
  ): Promise<FilePageProjection | null> {
    const [page] = await db
      .update(filePages)
      .set({ ocrStatus, updatedAt: new Date() })
      .where(eq(filePages.id, pageId))
      .returning();

    return page || null;
  }

  async updateFilePagesStatus(
    db: DbExecutor,
    fileId: string,
    pageIds: string[],
    status: FilePageOCRStatus,
  ): Promise<FilePageProjection[]> {
    if (pageIds.length === 0) return [];

    return db
      .update(filePages)
      .set({
        ocrStatus: status,
        updatedAt: new Date(),
      })
      .where(and(eq(filePages.fileId, fileId), inArray(filePages.id, pageIds)))
      .returning();
  }

  async delete(
    db: DbExecutor,
    data: DeleteDocumentCommand,
  ): Promise<DocumentProjection | null> {
    const [document] = await db
      .delete(documents)
      .where(
        and(eq(documents.id, data.documentId), eq(documents.userId, data.userId)),
      )
      .returning();

    return document || null;
  }

  async deleteFile(
    db: DbExecutor,
    data: DeleteDocumentFileCommand,
  ): Promise<DocumentFileProjection | null> {
    const [file] = await db
      .delete(documentFiles)
      .where(
        and(
          eq(documentFiles.id, data.fileId),
          eq(documentFiles.documentId, data.documentId),
        ),
      )
      .returning();

    return file || null;
  }

  async deleteFilePage(
    db: DbExecutor,
    data: DeleteFilePageCommand,
  ): Promise<FilePageProjection | null> {
    const [page] = await db
      .delete(filePages)
      .where(
        and(eq(filePages.id, data.pageId), eq(filePages.fileId, data.fileId)),
      )
      .returning();

    return page || null;
  }

  // ==================== QUERIES (reads) ====================

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
      .where(and(eq(documents.userId, userId), inArray(documents.id, documentIds)));

    return rows.map((r) => r.id);
  }
}

export const documentsRepository = new DocumentsRepository();