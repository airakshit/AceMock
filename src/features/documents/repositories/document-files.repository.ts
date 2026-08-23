import { documentFiles } from "@/db/schemas";
import { and, desc, eq, inArray } from "drizzle-orm";
import { generateUUIDv7 } from "../../shared/utils";
import { DbExecutor } from "../../shared/types";
import { DocumentFileStatus, DocumentFileType } from "../types";

export class DocumentFilesRepository {
  async create(
    db: DbExecutor,
    documentId: string,
    data: {
      originalFilename: string;
      mimeType: string;
      fileType: DocumentFileType;
      fileSize: number;
      storageUrl: string;
    },
  ) {
    const fileId = generateUUIDv7();

    const [file] = await db
      .insert(documentFiles)
      .values({
        id: fileId,
        documentId,
        originalFilename: data.originalFilename,
        mimeType: data.mimeType,
        fileType: data.fileType,
        fileSize: data.fileSize,
        storageUrl: data.storageUrl,
      })
      .returning();

    return file;
  }

  async createMany(
    db: DbExecutor,
    documentId: string,
    files: Array<{
      serverFileId: string;
      originalFilename: string;
      mimeType: string;
      fileType: DocumentFileType;
      fileSize: number;
      storageUrl: string;
    }>,
  ) {
    const values = files.map((file) => ({
      id: file.serverFileId,
      documentId,
      originalFilename: file.originalFilename,
      mimeType: file.mimeType,
      fileType: file.fileType,
      fileSize: file.fileSize,
      storageUrl: file.storageUrl,
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

  async update(
    db: DbExecutor,
    fileId: string,
    documentId: string,
    data: {
      originalFilename?: string;
      mimeType?: string;
      fileType?: DocumentFileType;
      fileSize?: number;
      storageUrl?: string;
      status?: DocumentFileStatus;
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
    status: DocumentFileStatus,
  ) {
    if (fileIds.length === 0) return [];

    return db
      .update(documentFiles)
      .set({
        status,
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
