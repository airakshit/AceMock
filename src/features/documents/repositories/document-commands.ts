import { documents, documentFiles, filePages } from "@/db/schemas";
import { and, eq, inArray } from "drizzle-orm";
import {
  DocumentProjection,
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
  ReconcileVerifiedFilesCommand,
} from "../dto/commands";
import { DbExecutor } from "../../shared/types";
import { FilePageOCRStatus } from "../types";

export class DocumentCommands {
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
        sessionId: data.sessionId,
        contentProbe: data.contentProbe,
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
      .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
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
   * Storage-verification reconciliation: flip verified uploads to
   * `completed` in one shot; `failedFileIds` are files that FAILED
   * verification and must not be committed.
   */
  async reconcileVerifiedFiles(
    db: DbExecutor,
    data: ReconcileVerifiedFilesCommand,
  ): Promise<DocumentFileProjection[]> {
    if (data.verifiedFileIds.length === 0 && data.failedFileIds.length === 0) {
      return [];
    }

    const verified =
      data.verifiedFileIds.length > 0
        ? await db
            .update(documentFiles)
            .set({ uploadStatus: "uploaded" })
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
            .set({ uploadStatus: "failed" })
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
        and(
          eq(documents.id, data.documentId),
          eq(documents.userId, data.userId),
        ),
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
}

export const documentCommands = new DocumentCommands();

