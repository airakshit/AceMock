import { documents, documentFiles, filePages } from "@/db/schemas";
import { and, eq, inArray } from "drizzle-orm";
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
  ReconcileVerifiedFilesCommand,
} from "../dto/commands";
import { DbExecutor } from "../../shared/types";
import { FilePageOCRStatus } from "../types";
import {
  DocumentDTO,
  DocumentFileDTO,
  DocumentFileProcessingRow,
  FilePageProjection,
  filePageProjectionReturning,
  documentDTOReturning,
  documentFileDTOReturning,
  uploadSessionDTOReturning,
} from "../dto/projections";

/**
 * Internal selector for the processing pipeline — mirrors
 * `DocumentFileProcessingRow` (keeps `id`/`storagePath`, not the public DTO).
 */
const documentFileProcessingRowReturning = {
  id: documentFiles.id,
  filename: documentFiles.filename,
  mimeType: documentFiles.mimeType,
  storagePath: documentFiles.storagePath,
  processingStatus: documentFiles.processingStatus,
};

export class DocumentCommands {
  async create(
    db: DbExecutor,
    data: CreateDocumentCommand,
  ): Promise<DocumentDTO> {
    const [document] = await db
      .insert(documents)
      .values({
        id: data.documentId,
        userId: data.userId,
        title: data.title,
        description: data.description,
      })
      .returning(documentDTOReturning);

    return document;
  }

  async createFile(
    db: DbExecutor,
    data: CreateDocumentFileCommand,
  ): Promise<DocumentFileDTO> {
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
      .returning(documentFileDTOReturning);

    return file;
  }

  async createManyFiles(
    db: DbExecutor,
    data: CreateDocumentFileCommand[],
  ): Promise<DocumentFileDTO[]> {
    if (data.length === 0) return [];

    return db
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
      .returning(documentFileDTOReturning);
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
      .returning(filePageProjectionReturning);

    return page;
  }

  async createManyFilePages(
    db: DbExecutor,
    data: CreateFilePageCommand[],
  ): Promise<FilePageProjection[]> {
    if (data.length === 0) return [];

    return db
      .insert(filePages)
      .values(
        data.map((page) => ({
          id: page.id,
          fileId: page.fileId,
          pageNo: page.pageNo,
        })),
      )
      .returning(filePageProjectionReturning);
  }

  async update(
    db: DbExecutor,
    data: UpdateDocumentCommand,
  ): Promise<DocumentDTO | null> {
    const { documentId, userId, title, description, status } = data;

    const [document] = await db
      .update(documents)
      .set({
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { processingStatus: status }),
        ...(data.delete === true && { deletedAt: new Date() }),
        updatedAt: new Date(),
      })
      .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
      .returning(documentDTOReturning);

    return document || null;
  }

  async updateFile(
    db: DbExecutor,
    data: UpdateDocumentFileCommand,
  ): Promise<DocumentFileDTO | null> {
    const [file] = await db
      .update(documentFiles)
      .set({
        ...(data.filename !== undefined && { filename: data.filename }),
        ...(data.mimeType !== undefined && { mimeType: data.mimeType }),
        ...(data.fileSize !== undefined && { fileSize: data.fileSize }),
        ...(data.storagePath !== undefined && {
          storagePath: data.storagePath,
        }),
        ...(data.uploadStatus !== undefined && {
          uploadStatus: data.uploadStatus,
        }),
        ...(data.uploadRef !== undefined && { uploadRef: data.uploadRef }),
        // Timestamp the reference whenever the ref itself is replaced.
        ...(data.uploadRef !== undefined && {
          uploadRefCreatedAt: new Date(),
        }),

        // Soft deleting the file.
        ...(data.delete === true && {
          deletedAt: new Date(),
        }),
      })
      .where(
        and(
          eq(documentFiles.id, data.fileId),
          eq(documentFiles.documentId, data.documentId),
        ),
      )
      .returning(documentFileDTOReturning);

    return file || null;
  }

  /**
   * Batch-flip uploadStatus for several files of one document.
   */
  async updateFilesUploadStatus(
    db: DbExecutor,
    data: UpdateFilesUploadStatusCommand,
  ): Promise<DocumentFileDTO[]> {
    if (data.fileIds.length === 0) return [];

    return db
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
      .returning(documentFileDTOReturning);
  }

  /**
   * Storage-verification reconciliation: flip verified uploads to
   * `completed` in one shot; `failedFileIds` are files that FAILED
   * verification and must not be committed.
   */
  async reconcileVerifiedFiles(
    db: DbExecutor,
    data: ReconcileVerifiedFilesCommand,
  ): Promise<DocumentFileDTO[]> {
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
            .returning(documentFileDTOReturning)
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
            .returning(documentFileDTOReturning)
        : [];

    return [...verified, ...failed];
  }

  async updateFileProcessingStatus(
    db: DbExecutor,
    data: UpdateDocumentFileProcessingStatusCommand,
  ): Promise<DocumentFileProcessingRow[]> {
    return db
      .update(documentFiles)
      .set({
        processingStatus: data.status,
      })
      .where(eq(documentFiles.documentId, data.documentId))
      .returning(documentFileProcessingRowReturning);
  }

  async updateFilePage(
    db: DbExecutor,
    data: UpdateFilePageCommand,
  ): Promise<FilePageProjection | null> {
    const [page] = await db
      .update(filePages)
      .set({
        pageNo: data.pageNo,
        ...(data.ocrText !== undefined && { ocrText: data.ocrText }),
        ...(data.ocrStatus !== undefined && { ocrStatus: data.ocrStatus }),
        ...(data.isRelevant !== undefined && { isRelevant: data.isRelevant }),
        ...(data.fnVersion !== undefined && { fnVersion: data.fnVersion }),
        ...(data.ocrModel !== undefined && { ocrModel: data.ocrModel }),
        ...(data.survivedValidation !== undefined && {
          survivedValidation: data.survivedValidation,
        }),
        updatedAt: new Date(),
      })
      .where(
        and(eq(filePages.id, data.pageId), eq(filePages.fileId, data.fileId)),
      )
      .returning(filePageProjectionReturning);

    return page || null;
  }

  async updateFilePageStatus(
    db: DbExecutor,
    fileId: string,
    ocrStatus: FilePageOCRStatus,
  ): Promise<FilePageProjection[]> {
    return db
      .update(filePages)
      .set({
        ocrStatus,
        updatedAt: new Date(),
      })
      .where(eq(filePages.fileId, fileId))
      .returning(filePageProjectionReturning);
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
      .returning(filePageProjectionReturning);

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
      .returning(filePageProjectionReturning);
  }

  async delete(
    db: DbExecutor,
    data: DeleteDocumentCommand,
  ): Promise<DocumentDTO | null> {
    const [document] = await db
      .delete(documents)
      .where(
        and(
          eq(documents.id, data.documentId),
          eq(documents.userId, data.userId),
        ),
      )
      .returning(documentDTOReturning);

    return document || null;
  }

  async deleteFile(
    db: DbExecutor,
    data: DeleteDocumentFileCommand,
  ): Promise<DocumentFileDTO | null> {
    const [file] = await db
      .delete(documentFiles)
      .where(
        and(
          eq(documentFiles.id, data.fileId),
          eq(documentFiles.documentId, data.documentId),
        ),
      )
      .returning(documentFileDTOReturning);

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
      .returning(filePageProjectionReturning);

    return page || null;
  }
}

export const documentCommands = new DocumentCommands();
