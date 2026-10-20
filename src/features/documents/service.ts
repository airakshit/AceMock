import { db } from "@/db";
import {
  CreateNewDocumentActionPayload,
  FinalizeDocumentUploadActionPayload,
} from "./actions/types";
import { documentsRepository } from "./repositories/documents.repository";
import type { DocumentWithQuestionCountProjection } from "./dto/projections";
import { documentQueries } from "./repositories/document-queries";
import { storagePaths } from "@/lib/supabase/storage-paths";
import { generateUUIDv7 } from "../shared/utils";
import { supabaseStorageClient } from "../shared/storage-service";
import { ServerActionError } from "../shared/actions/error";
import { inngest } from "@/inngest/client";
import { EXTRACT_QUESTIONS_EVENT } from "@/inngest/functions/v1/extract-questions/func";
import {
  DocumentProcessingStatus,
  FileUploadStatus,
  FileProcessingStatus,
} from "./types";
import { documentFiles } from "@/db/schemas";
import { and, eq } from "drizzle-orm";

class DocumentsService {
  async createNewDocument(
    userId: string,
    payload: CreateNewDocumentActionPayload,
  ) {
    const documentId = generateUUIDv7();

    const pdfs = payload.pdfs.map((value) => {
      const documentFileId = generateUUIDv7();
      return {
        serverFileId: documentFileId,
        clientFileId: value.clientFileId,
        documentFileId: documentFileId,
        filename: value.name,
        mimeType: value.type,
        fileSize: value.size,
        storagePath: storagePaths.getDocumentFileSourceUrl(
          userId,
          documentId,
          documentFileId,
          value.name,
        ),
      };
    });
    const images = payload.images.map((value) => {
      const documentFileId = generateUUIDv7();
      return {
        serverFileId: documentFileId,
        clientFileId: value.clientFileId,
        filename: value.name,
        mimeType: value.type,
        fileSize: value.size,
        storagePath: storagePaths.getDocumentFileSourceUrl(
          userId,
          documentId,
          documentFileId,
          value.name,
        ),
      };
    });

    const result = await db.transaction(async (tx) => {
      const newDoc = await documentsRepository.create(tx, {
        documentId: documentId,
        userId,
        title: payload.title,
        description: payload.description,
      });

      const fileCommands = [
        ...pdfs.map((f) => ({
          id: f.serverFileId,
          documentId,
          filename: f.filename,
          mimeType: f.mimeType,
          fileSize: f.fileSize,
          storagePath: f.storagePath,
        })),
        ...images.map((f) => ({
          id: f.serverFileId,
          documentId,
          filename: f.filename,
          mimeType: f.mimeType,
          fileSize: f.fileSize,
          storagePath: f.storagePath,
        })),
      ];

      await documentsRepository.createManyFiles(tx, fileCommands);

      return {
        document: newDoc,
      };
    });

    const signedUrls = await supabaseStorageClient.getUploadSignedUrls([
      ...pdfs.map((value) => {
        return {
          clientFileId: value.clientFileId,
          serverFileId: value.serverFileId,
          storagePath: value.storagePath,
        };
      }),
      ...images.map((value) => {
        return {
          clientFileId: value.clientFileId,
          serverFileId: value.serverFileId,
          storagePath: value.storagePath,
        };
      }),
    ]);

    return {
      documentId: documentId,
      files: signedUrls,
    };
  }

  async finalizeDocumentUpload(
    userId: string,
    payload: FinalizeDocumentUploadActionPayload,
  ) {
    const existingDocument = await documentsRepository.findByIdForUser(
      db,
      payload.documentId,
      userId,
    );

    if (!existingDocument) {
      throw new ServerActionError(
        "NOT_FOUND",
        "Document not found or access denied.",
      );
    }

    // Use the batch update method
    for (const fileId of payload.fileIds) {
      await documentsRepository.updateFile(db, {
        fileId,
        documentId: payload.documentId,
        uploadStatus: "uploaded" as FileUploadStatus,
      });
    }

    return {
      fileIds: payload.fileIds,
    };
  }

  async getUserDocuments(userId: string) {
    return documentsRepository.findByUserWithFiles(db, userId);
  }

  /**
   * Lightweight picker list: the user's own documents with how many questions
   * each one has contributed. Shared by the admin and student mock-creation
   * flows — the admin simply sees their own documents.
   */
  async getDocumentsSummary(
    userId: string,
  ): Promise<DocumentWithQuestionCountProjection[]> {
    return documentsRepository.findDocumentsWithQuestionsCountForUser(
      db,
      userId,
    );
  }

  async deleteDocument(userId: string, documentId: string) {
    const existingDocument = await documentsRepository.findByIdForUser(
      db,
      documentId,
      userId,
    );

    if (!existingDocument) {
      throw new ServerActionError(
        "NOT_FOUND",
        "Document not found or access denied.",
      );
    }

    // 1. Delete all Supabase storage objects under the document folder
    const documentStorageFolder = `user/${userId}/documents/${documentId}`;
    try {
      await supabaseStorageClient.deleteFolder(documentStorageFolder);
    } catch (storageError) {
      console.error(
        `Failed to delete storage objects for document ${documentId}:`,
        storageError,
      );
    }

    // 2. Delete database record of document.
    // Foreign key cascade (onDelete: "cascade") automatically deletes associated document_files and file_pages.
    const deletedDocument = await documentsRepository.delete(db, {
      documentId,
      userId,
    });

    if (!deletedDocument) {
      throw new ServerActionError(
        "INTERNAL_ERROR",
        "Failed to delete document.",
      );
    }

    return {
      documentId: deletedDocument.id,
    };
  }

  async deleteDocumentFile(userId: string, documentId: string, fileId: string) {
    const existingDocument = await documentsRepository.findByIdForUser(
      db,
      documentId,
      userId,
    );

    if (!existingDocument) {
      throw new ServerActionError(
        "NOT_FOUND",
        "Document not found or access denied.",
      );
    }

    const file = await db
      .select()
      .from(documentFiles)
      .where(
        and(
          eq(documentFiles.id, fileId),
          eq(documentFiles.documentId, documentId),
        ),
      )
      .limit(1);

    if (!file[0]) {
      throw new ServerActionError(
        "NOT_FOUND",
        "File not found or does not belong to this document.",
      );
    }

    // 1. Delete storage folder for this file
    const fileStorageFolder = storagePaths._getDocumentFilePath(
      userId,
      documentId,
      fileId,
    );
    try {
      await supabaseStorageClient.deleteFolder(fileStorageFolder);
    } catch (storageError) {
      console.error(
        `Failed to delete storage folder for file ${fileId}:`,
        storageError,
      );
    }

    // Also ensure direct file storagePath is deleted if still present
    if (file[0].storagePath) {
      try {
        await supabaseStorageClient.deleteFiles([file[0].storagePath]);
      } catch (err) {
        // Ignored if already cleaned by deleteFolder
      }
    }

    // 2. Delete file record from DB.
    await documentsRepository.deleteFile(db, {
      fileId,
      documentId,
    });

    return {
      documentId,
      fileId,
    };
  }

  async updateDocument(
    userId: string,
    documentId: string,
    payload: { title: string; description?: string },
  ) {
    const existingDocument = await documentsRepository.findByIdForUser(
      db,
      documentId,
      userId,
    );

    if (!existingDocument) {
      throw new ServerActionError(
        "NOT_FOUND",
        "Document not found or access denied.",
      );
    }

    const trimmedTitle = payload.title.trim();
    if (!trimmedTitle) {
      throw new ServerActionError(
        "BAD_REQUEST",
        "Document title cannot be empty.",
      );
    }

    await documentsRepository.update(db, {
      documentId,
      userId,
      title: trimmedTitle,
      description: payload.description?.trim() || undefined,
    });

    const userDocs = await documentsRepository.findByUserWithFiles(db, userId);
    const updatedDoc = userDocs.find((doc) => doc.id === documentId);

    if (!updatedDoc) {
      throw new ServerActionError(
        "NOT_FOUND",
        "Document not found after update.",
      );
    }

    return {
      document: updatedDoc,
    };
  }

  async getDocumentFileAccessUrl(
    userId: string,
    documentId: string,
    fileId: string,
    expiresIn = 3600,
  ) {
    const existingDocument = await documentsRepository.findByIdForUser(
      db,
      documentId,
      userId,
    );

    if (!existingDocument) {
      throw new ServerActionError(
        "NOT_FOUND",
        "Document not found or access denied.",
      );
    }

    const file = await db
      .select()
      .from(documentFiles)
      .where(
        and(
          eq(documentFiles.id, fileId),
          eq(documentFiles.documentId, documentId),
        ),
      )
      .limit(1);

    if (!file[0]) {
      throw new ServerActionError(
        "NOT_FOUND",
        "File not found or does not belong to this document.",
      );
    }

    const signedUrl = await supabaseStorageClient.getPageAccessUrl(
      file[0].storagePath,
      expiresIn,
    );

    return {
      fileId: file[0].id,
      filename: file[0].filename,
      mimeType: file[0].mimeType,
      fileSize: file[0].fileSize,
      signedUrl,
    };
  }

  async processDocument(userId: string, documentId: string) {
    const document = await documentsRepository.findByIdForUser(
      db,
      documentId,
      userId,
    );

    if (!document) {
      throw new ServerActionError(
        "NOT_FOUND",
        "Document not found or access denied.",
      );
    }

    const docWithPages = await documentQueries.getDocumentWithPages(
      db,
      documentId,
      userId,
    );

    if (
      !docWithPages ||
      !docWithPages.files ||
      docWithPages.files.length === 0
    ) {
      throw new ServerActionError(
        "BAD_REQUEST",
        "Cannot process a document with no uploaded files.",
      );
    }

    const totalPages = docWithPages.files.reduce(
      (acc, f) => acc + (f.pages?.length || 0),
      0,
    );

    if (totalPages === 0) {
      await inngest.send({
        name: "document/process",
        data: {
          userId,
          documentId,
        },
      });
    } else {
      await inngest.send({
        name: EXTRACT_QUESTIONS_EVENT,
        data: {
          userId,
          documentId,
        },
      });
    }

    const updatedDoc = await documentsRepository.findByIdForUserWithFiles(
      db,
      documentId,
      userId,
    );

    if (!updatedDoc) {
      throw new ServerActionError(
        "NOT_FOUND",
        "Document not found after trigger.",
      );
    }

    return {
      document: updatedDoc,
      message: "Document processing triggered successfully.",
    };
  }

  async getDocumentStatus(userId: string, documentId: string) {
    const document = await documentsRepository.findByIdForUserWithFiles(
      db,
      documentId,
      userId,
    );

    if (!document) {
      throw new ServerActionError(
        "NOT_FOUND",
        "Document not found or access denied.",
      );
    }

    return {
      document,
    };
  }
}

export const documentsService = new DocumentsService();
