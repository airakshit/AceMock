import { db } from "@/db";
import {
  CreateNewDocumentActionPayload,
  FinalizeDocumentUploadActionPayload,
} from "./actions/types";
import { documentsRepository } from "./repositories/documents.repository";
import { documentFilesRepository } from "./repositories/document-files.repository";
import { storagePaths } from "@/lib/supabase/storage-paths";
import { generateUUIDv7 } from "../shared/utils";
import { supabaseStorageClient } from "./storage-service";
import { ServerActionError } from "../shared/actions/error";

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
}

export const documentsService = new DocumentsService();
