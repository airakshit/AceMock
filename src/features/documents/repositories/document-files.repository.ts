import { documentFiles } from "@/db/schemas";
import { and, desc, eq, inArray } from "drizzle-orm";
import { generateUUIDv7 } from "../../shared/utils";
import { DbExecutor } from "../../shared/types";
import { FileProcessingStatus, FileUploadStatus } from "../types";

export class DocumentFilesRepository {
  async create(
    db: DbExecutor,
    documentId: string,
    data: {
      filename: string;
      mimeType: string;
      fileSize: number;
      storagePath: string;
    },
  ) {
    const fileId = generateUUIDv7();

    const [file] = await db
      .insert(documentFiles)
      .values({
        id: fileId,
        documentId,
        filename: data.filename,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        storagePath: data.storagePath,
      })
      .returning();

    return file;
  }

  async createMany(
    db: DbExecutor,
    documentId: string,
    files: Array<{
      serverFileId: string;
      filename: string;
      mimeType: string;
      fileSize: number;
      storagePath: string;
    }>,
  ) {
    const values = files.map((file) => ({
      id: file.serverFileId,
      documentId,
      filename: file.filename,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
      storagePath: file.storagePath,
    }));

    const createdFiles = await db
      .insert(documentFiles)
      .values(values)
      .returning();

    return createdFiles;
  }

  async findById(db: DbExecutor, fileId: string) {
    const [file] = await db
      .select()
      .from(documentFiles)
      .where(eq(documentFiles.id, fileId))
      .limit(1);

    return file;
  }

  async findByIdForDocument(
    db: DbExecutor,
    fileId: string,
    documentId: string,
  ) {
    const [file] = await db
      .select()
      .from(documentFiles)
      .where(
        and(
          eq(documentFiles.id, fileId),
          eq(documentFiles.documentId, documentId),
        ),
      )
      .limit(1);

    return file;
  }

  async findByDocument(db: DbExecutor, documentId: string) {
    return db
      .select()
      .from(documentFiles)
      .where(eq(documentFiles.documentId, documentId))
      .orderBy(desc(documentFiles.createdAt));
  }

  async updateStatusByDocumentId(
    db: DbExecutor,
    documentId: string,
    status: FileProcessingStatus,
  ) {
    const files = await db
      .update(documentFiles)
      .set({
        processingStatus: status,
      })
      .where(eq(documentFiles.documentId, documentId))
      .returning();

    return files;
  }

  async update(
    db: DbExecutor,
    fileId: string,
    documentId: string,
    data: {
      filename?: string;
      mimeType?: string;
      fileSize?: number;
      storagePath?: string;
      uploadStatus?: FileUploadStatus;
    },
  ) {
    const [file] = await db
      .update(documentFiles)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(documentFiles.id, fileId),
          eq(documentFiles.documentId, documentId),
        ),
      )
      .returning();

    return file;
  }

  async delete(db: DbExecutor, fileId: string, documentId: string) {
    const [file] = await db
      .delete(documentFiles)
      .where(
        and(
          eq(documentFiles.id, fileId),
          eq(documentFiles.documentId, documentId),
        ),
      )
      .returning();

    return file;
  }

  async updateStatusForFiles(
    db: DbExecutor,
    documentId: string,
    fileIds: string[],
    status: FileUploadStatus,
  ) {
    if (fileIds.length === 0) return [];

    return db
      .update(documentFiles)
      .set({
        uploadStatus: status,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(documentFiles.documentId, documentId),
          inArray(documentFiles.id, fileIds),
        ),
      )
      .returning();
  }
}

export const documentFilesRepository = new DocumentFilesRepository();
