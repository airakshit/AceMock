import { db } from "@/db";
import {
  CreateNewDocumentActionPayload,
  FinalizeDocumentUploadActionPayload,
} from "./actions/types";
import { documentsRepository } from "./repositories/documents.repository";
import { documentFilesRepository } from "./repositories/document-files.repository";
import { storagePaths } from "@/lib/supabase/storage-paths";
import { generateUUIDv7 } from "../shared/utils";
import { supabaseStorageClient } from "../shared/storage-service";
import { ServerActionError } from "../shared/actions/error";
import { inngest } from "@/inngest/client";
import { documentQueries } from "./repositories/document-queries";
import { filePagesRepository } from "./repositories/file-pages.repository";
import { EXTRACT_QUESTIONS_EVENT } from "@/inngest/functions/extract-questions/extract-questions";

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
      const newDoc = await documentsRepository.create(tx, userId, {
        documentId: documentId,
        title: payload.title,
        description: payload.description,
      });

      const files = await documentFilesRepository.createMany(tx, newDoc.id, [
        ...pdfs,
        ...images,
      ]);
      return {
        document: newDoc,
        files: files,
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

    const updatedFiles = await documentFilesRepository.updateStatusForFiles(
      db,
      payload.documentId,
      payload.fileIds,
      "uploaded",
    );

    return {
      fileIds: updatedFiles.map((f) => f.id),
    };
  }

  async getUserDocuments(userId: string) {
    return documentsRepository.findByUserWithFiles(db, userId);
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
    const deletedDocument = await documentsRepository.delete(
      db,
      documentId,
      userId,
    );

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

    const existingFile = await documentFilesRepository.findByIdForDocument(
      db,
      fileId,
      documentId,
    );

    if (!existingFile) {
      throw new ServerActionError(
        "NOT_FOUND",
        "File not found or does not belong to this document.",
      );
    }

    // 1. Delete storage folder for this file: user/${userId}/documents/${documentId}/files/${fileId}
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
    if (existingFile.storagePath) {
      try {
        await supabaseStorageClient.deleteFiles([existingFile.storagePath]);
      } catch (err) {
        // Ignored if already cleaned by deleteFolder
      }
    }

    // 2. Delete file record from DB.
    // Foreign key cascade (onDelete: "cascade") automatically deletes associated file_pages.
    const deletedFile = await documentFilesRepository.delete(
      db,
      fileId,
      documentId,
    );

    return {
      documentId,
      fileId: deletedFile.id,
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

    await documentsRepository.update(db, documentId, userId, {
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

    const existingFile = await documentFilesRepository.findByIdForDocument(
      db,
      fileId,
      documentId,
    );

    if (!existingFile) {
      throw new ServerActionError(
        "NOT_FOUND",
        "File not found or does not belong to this document.",
      );
    }

    const signedUrl = await supabaseStorageClient.getPageAccessUrl(
      existingFile.storagePath,
      expiresIn,
    );

    return {
      fileId: existingFile.id,
      filename: existingFile.filename,
      mimeType: existingFile.mimeType,
      fileSize: existingFile.fileSize,
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

    if (!docWithPages || !docWithPages.files || docWithPages.files.length === 0) {
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
      // Preprocessing needed: convert files into page images, then extract questions
      await documentsRepository.updateProcessingStatus(
        db,
        documentId,
        "processing",
      );

      await inngest.send({
        name: "document/process",
        data: {
          userId,
          documentId,
        },
      });
    } else {
      // Pages already exist; reset page status if re-processing and trigger question extraction
      for (const file of docWithPages.files) {
        for (const page of file.pages) {
          if (page.ocrStatus !== "ocr") {
            await filePagesRepository.updateStatusByPageId(db, page.id, "ocr");
          }
        }
      }

      await documentsRepository.updateProcessingStatus(
        db,
        documentId,
        "extracting_questions",
      );

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
      throw new ServerActionError("NOT_FOUND", "Document not found after trigger.");
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
