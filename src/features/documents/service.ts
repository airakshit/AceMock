import { db } from "@/db";
import {
  CreateDocumentActionPayload,
  SaveUploadReferenceActionPayload,
  HeartbeatUploadSessionActionPayload,
  ResumeDocumentUploadActionPayload,
  CompleteDocumentFileUploadActionPayload,
  CompleteUploadSessionActionPayload,
  DocumentSearchQueryPayload,
} from "./dto/payloads";
import {
  CreateDocumentActionResponse,
  SaveUploadReferenceActionResponse,
  HeartbeatUploadSessionActionResponse,
  GetUploadSessionStatusActionResponse,
  ResumeDocumentUploadActionResponse,
  DocumentFileRecoveryPlan,
  CompleteDocumentFileUploadActionResponse,
  CompleteUploadSessionActionResponse,
  DocumentSearchQueryResponse,
  GetUserDocumentActionResponse,
  DeleteDocumentActionResponse,
  DeleteDocumentFileActionResponse,
  GetDocumentsSummaryActionResponse,
  ProcessDocumentActionResponse,
  GetDocumentFileAccessUrlActionResponse,
  DocumentFileWithSignedUrls,
} from "./dto/results";
import { UploadSessionDTO, DocumentWithFilesDTO } from "./dto/projections";

import { documentRepository } from "./repositories/documents.repository";
import {
  uploadSessionsRepository,
  type UploadSessionRow,
} from "./repositories/upload-sessions.repository";
import type { DocumentDTO } from "./dto/projections";
import {
  PDFStoragePathsRetriever,
  ImageStoragePathsRetriever,
} from "@/lib/supabase/storage-paths";
import { generateUUIDv7 } from "../shared/utils";
import { supabaseStorageClient } from "../shared/storage-service";
import { ServerActionError } from "../shared/actions/error";
import { inngest } from "@/inngest/client";
import { FileUploadStatus } from "./types";
import { decideFileRecoveryAction } from "./uploads/recovery-decision";
import { documentFiles } from "@/db/schemas";
import { and, eq } from "drizzle-orm";
import { probeTusResource } from "@/lib/supabase/tus-probe";
import {
  UPLOAD_RECOVERY_WINDOW_MS,
  UPLOAD_TUS_RESOURCE_LIFETIME_MS,
} from "./uploads/upload-session-constants";
import { PROCESS_DOCUMENT_EVENT as PROCESS_DOCUMENT_EVENT_V2 } from "@/inngest/functions/v2/process-document";
import { decodeSearchCursor, encodeSearchCursor } from "../shared/pagination";
import { validateDocumentSearchCursor } from "./validators";

class DocumentsService {
  private static readonly DOCUMENTS_PAGE_SIZE = 20;
  private static readonly MAX_DOCUMENTS_PAGE_SIZE = 50;

  private toSessionDTO(session: UploadSessionRow): UploadSessionDTO {
    return {
      sessionId: session.id,
      status: session.status,
      lastHeartbeatAt: session.lastHeartbeatAt,
      recoveryExpiresAt: session.recoveryExpiresAt,
      progress: (session.progress as Record<string, number>) ?? {},
    };
  }

  async createDocument(
    userId: string,
    payload: CreateDocumentActionPayload,
  ): Promise<CreateDocumentActionResponse> {
    const documentId = generateUUIDv7();
    const sessionId = generateUUIDv7();
    const recoveryExpiresAt = new Date(Date.now() + UPLOAD_RECOVERY_WINDOW_MS);

    if (payload.files.length === 0) {
      throw new ServerActionError("BAD_REQUEST", "No files to upload.");
    }

    const fileModels = payload.files.map((file) => {
      const documentFileId = generateUUIDv7();
      return {
        clientFileId: file.clientFileId,
        serverFileId: documentFileId,
        contentProbe: file.contentProbe,
        filename: file.name,
        mimeType: file.mimeType,
        fileSize: file.size,
        storagePath:
          file.mimeType === "application/pdf"
            ? PDFStoragePathsRetriever.getDocumentFileSourceUrl(
                userId,
                documentId,
                documentFileId,
                file.name,
              )
            : ImageStoragePathsRetriever.getDocumentFileSourceUrl(
                userId,
                documentId,
                documentFileId,
                file.name,
              ),
      };
    });

    const data = await db.transaction(async (tx) => {
      const createdDoc = await documentRepository.commands.create(tx, {
        documentId: documentId,
        userId,
        title: payload.title,
        description: payload.description,
      });

      // Session is created first because, files require the id.
      const uploadSession = await uploadSessionsRepository.create(tx, {
        id: sessionId,
        userId,
        documentId,
        recoveryExpiresAt,
      });

      if (uploadSession === null) {
        throw new ServerActionError(
          "FAILED",
          "Failed to create upload session for document.",
        );
      }

      const files = await documentRepository.commands.createManyFiles(
        tx,
        fileModels.map((f) => ({
          id: f.serverFileId,
          documentId,
          sessionId,
          contentProbe: f.contentProbe,
          filename: f.filename,
          mimeType: f.mimeType,
          fileSize: f.fileSize,
          storagePath: f.storagePath,
        })),
      );

      return { document: createdDoc, session: uploadSession, files: files };
    });

    const signedUrls = await supabaseStorageClient.getUploadSignedUrls(
      fileModels.map((f) => ({
        clientFileId: f.clientFileId,
        serverFileId: f.serverFileId,
        storagePath: f.storagePath,
      })),
    );

    const filesData: DocumentFileWithSignedUrls[] = data.files.flatMap(
      (file) => {
        const signedFile = signedUrls.find(
          (value) => value.fileId === file.fileId,
        );
        if (signedFile) {
          return {
            clientFileId: signedFile.clientFileId,
            fileId: file.fileId,
            filename: file.filename,
            size: file.size,
            mimeType: file.mimeType,
            storagePath: file.storagePath,
            uploadStatus: file.uploadStatus,
            contentProbe: file.contentProbe,
            token: signedFile.token,
            signedUrl: signedFile.signedUrl,
          };
        }
        return [];
      },
    );

    return {
      ...data.document,
      session: data.session,
      files: filesData,
    };
  }

  async saveUploadReference(
    userId: string,
    payload: SaveUploadReferenceActionPayload,
  ): Promise<SaveUploadReferenceActionResponse> {
    const session = await uploadSessionsRepository.findByIdForUser(
      db,
      payload.sessionId,
      userId,
    );

    if (!session) {
      throw new ServerActionError(
        "NOT_FOUND",
        "Upload session not found or access denied.",
      );
    }

    if (session.status !== "active") {
      throw new ServerActionError(
        "CONFLICT",
        `Upload session is not active (status: ${session.status}).`,
      );
    }

    const updated = await documentRepository.commands.updateFile(db, {
      fileId: payload.documentFileId,
      documentId: session.documentId,
      uploadRef: payload.uploadRef,
    });

    if (!updated) {
      throw new ServerActionError(
        "NOT_FOUND",
        "File not found or access denied.",
      );
    }

    return {
      fileId: updated.fileId,
      sessionId: payload.sessionId,
      uploadStatus: updated.uploadStatus,
    };
  }

  async heartbeatUploadSession(
    userId: string,
    payload: HeartbeatUploadSessionActionPayload,
  ): Promise<HeartbeatUploadSessionActionResponse> {
    const session = await uploadSessionsRepository.findByIdForUser(
      db,
      payload.sessionId,
      userId,
    );

    if (!session) {
      throw new ServerActionError(
        "NOT_FOUND",
        "Upload session not found or access denied.",
      );
    }

    const now = Date.now();

    // heartbeats against a terminal session are rejected — the
    // only valid next steps for a terminal session are read-only views or a
    // brand new attempt.
    if (session.status !== "active") {
      throw new ServerActionError(
        "CONFLICT",
        `Upload session is not active (status: ${session.status}).`,
      );
    }

    // Lazy expiry: an active session outside its recovery window is
    // abandoned right here (in addition to the Inngest sweep).
    if (now > session.recoveryExpiresAt.getTime()) {
      await uploadSessionsRepository.updateStatus(db, {
        sessionId: session.id,
        status: "abandoned",
        endReason: "recovery-window-elapsed",
      });

      throw new ServerActionError(
        "CONFLICT",
        "Upload session recovery window has elapsed.",
      );
    }

    const progress =
      payload.files && payload.files.length > 0
        ? Object.fromEntries(
            payload.files.map((f) => [
              f.documentFileId,
              { status: f.status, offsetBytes: f.offsetBytes ?? null },
            ]),
          )
        : undefined;

    const updated = await uploadSessionsRepository.touchHeartbeat(db, {
      sessionId: session.id,
      progress,
    });

    return {
      sessionId: session.id,
      lastHeartbeatAt: updated?.lastHeartbeatAt ?? new Date(now),
      recoveryExpiresAt: session.recoveryExpiresAt,
      accepted: true,
    };
  }

  async getUploadSessionStatus(
    userId: string,
    documentId: string,
  ): Promise<GetUploadSessionStatusActionResponse | null> {
    const latest = await uploadSessionsRepository.findLatestByDocumentIdForUser(
      db,
      documentId,
      userId,
    );

    if (latest === null) {
      throw new ServerActionError(
        "NOT_FOUND",
        "Document session not found or access denied.",
      );
    }

    return latest;
  }

  async resumeDocumentUpload(
    userId: string,
    payload: ResumeDocumentUploadActionPayload,
  ): Promise<ResumeDocumentUploadActionResponse> {
    const docLatestSession =
      await uploadSessionsRepository.findLatestByDocumentIdForUser(
        db,
        userId,
        payload.documentId,
      );

    if (!docLatestSession) {
      throw new ServerActionError(
        "NOT_FOUND",
        "Document session not found or access denied.",
      );
    }
  }

  async completeUploadSession(
    userId: string,
    payload: CompleteUploadSessionActionPayload,
  ): Promise<CompleteUploadSessionActionResponse> {
    const session = await uploadSessionsRepository.findByIdForUser(
      db,
      payload.sessionId,
      userId,
    );

    if (!session) {
      throw new ServerActionError(
        "NOT_FOUND",
        "Upload session not found or access denied.",
      );
    }

    if (session.status !== "active") {
      // Idempotent completion: a session already committed returns itself.
      if (session.status === "completed") {
        return {
          sessionId: session.id,
          status: session.status,
          unreconciledFiles: [],
        };
      }

      throw new ServerActionError(
        "CONFLICT",
        `Upload session is not active (status: ${session.status}).`,
      );
    }

    const files = await documentRepository.queries.findFilesBySessionId(
      db,
      session.id,
    );

    const failedBeforeVerification = files.filter(
      (f) => f.uploadStatus !== "uploading" && f.uploadStatus !== "uploaded",
    );

    if (
      failedBeforeVerification.some(
        (f) => f.uploadStatus === "pending" || f.uploadStatus === "failed",
      )
    ) {
      // Never commit an attempt with un-moved bytes — the client has a bug
      // or lost the race; report the mismatch instead of committing.
      return {
        sessionId: session.id,
        status: session.status,
        unreconciledFiles: files
          .filter(
            (f) => f.uploadStatus === "pending" || f.uploadStatus === "failed",
          )
          .map((f) => ({ serverFileId: f.id, uploadStatus: f.uploadStatus })),
      };
    }

    // ---- Storage verification (server-side existence check) ----
    const uploadedFiles = files.filter((f) => f.uploadStatus === "uploaded");

    const verification = await Promise.all(
      uploadedFiles.map(async (f) => {
        const exists = await supabaseStorageClient.objectExists(f.storagePath);
        return {
          serverFileId: f.id,
          uploadStatus: "uploaded" as FileUploadStatus,
          verified: exists,
        };
      }),
    );

    const verifiedFileIds = verification
      .filter((v) => v.verified)
      .map((v) => v.serverFileId);
    const unverifiableFileIds = verification
      .filter((v) => !v.verified)
      .map((v) => v.serverFileId);

    await documentRepository.commands.reconcileVerifiedFiles(db, {
      documentId: session.documentId,
      verifiedFileIds,
      failedFileIds: unverifiableFileIds,
    });

    if (unverifiableFileIds.length > 0) {
      // Do NOT complete the session — 1+ files lost bytes in storage and
      // must take the re-upload path on the next resume.
      await uploadSessionsRepository.touchHeartbeat(db, {
        sessionId: session.id,
        progress: {
          ...((session.progress as Record<string, unknown>) ?? {}),
          lastVerification: {
            at: new Date().toISOString(),
            verified: verifiedFileIds,
            unverifiable: unverifiableFileIds,
          },
        },
      });

      return {
        sessionId: session.id,
        status: session.status,
        unreconciledFiles: unverifiableFileIds.map((id) => ({
          serverFileId: id,
          uploadStatus: "failed" as FileUploadStatus,
        })),
      };
    }

    // Every file verified — the attempt is DONE (terminal; never revived).
    await uploadSessionsRepository.updateStatus(db, {
      sessionId: session.id,
      status: "completed",
      endReason: "all-files-completed",
    });

    return {
      sessionId: session.id,
      status: "completed",
      unreconciledFiles: [],
    };
  }

  /**
   * The client's TUS transfer for one file reached its final offset — the
   * SERVER records that fact (uploading → uploaded), it is not inferred
   * from any client-side state. The file only becomes `completed` after
   * storage verification in completeUploadSession.
   */
  async completeDocumentFileUpload(
    userId: string,
    payload: CompleteDocumentFileUploadActionPayload,
  ): Promise<CompleteDocumentFileUploadActionResponse> {
    const session = await uploadSessionsRepository.findByIdForUser(
      db,
      payload.sessionId,
      userId,
    );

    if (!session) {
      throw new ServerActionError(
        "NOT_FOUND",
        "Upload session not found or access denied.",
      );
    }

    if (session.status !== "active") {
      throw new ServerActionError(
        "CONFLICT",
        `Upload session is not active (status: ${session.status}).`,
      );
    }

    // Flip only files that belong to this session and are mid-transfer;
    // a second call for the same file is an idempotent no-op.
    const updated = await documentRepository.commands.updateFilesUploadStatus(
      db,
      {
        documentId: session.documentId,
        fileIds: [payload.documentFileId],
        uploadStatus: "uploaded",
      },
    );

    if (!updated.some((f) => f.fileId === payload.documentFileId)) {
      const [file] = await db
        .select({ uploadStatus: documentFiles.uploadStatus })
        .from(documentFiles)
        .where(
          and(
            eq(documentFiles.id, payload.documentFileId),
            eq(documentFiles.documentId, session.documentId),
            eq(documentFiles.sessionId, session.id),
          ),
        )
        .limit(1);

      if (!file) {
        throw new ServerActionError(
          "NOT_FOUND",
          "File not found in this upload session.",
        );
      }

      return {
        documentFileId: payload.documentFileId,
        uploadStatus: file.uploadStatus,
      };
    }

    return {
      documentFileId: payload.documentFileId,
      uploadStatus: "uploaded",
    };
  }

  async getDocumentsSummary(
    userId: string,
  ): Promise<GetDocumentsSummaryActionResponse> {
    return documentRepository.queries.findDocumentsWithQuestionsCountForUser(
      db,
      userId,
    );
  }

  async deleteDocument(
    userId: string,
    documentId: string,
  ): Promise<DeleteDocumentActionResponse> {
    const existingDocument = await documentRepository.queries.findByIdForUser(
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
    const deletedDocument = await documentRepository.commands.delete(db, {
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
      documentId: deletedDocument.documentId,
    };
  }

  async deleteDocumentFile(
    userId: string,
    documentId: string,
    fileId: string,
  ): Promise<DeleteDocumentFileActionResponse> {
    const documentWithSession =
      await documentRepository.queries.getSingleDocumentFileAndSession(
        db,
        userId,
        documentId,
        fileId,
      );

    if (!documentWithSession) {
      throw new ServerActionError("NOT_FOUND", "Document not found for file.");
    }
    if (!documentWithSession.file) {
      throw new ServerActionError(
        "NOT_FOUND",
        "File not found or accessed denied.",
      );
    }
    if (documentWithSession.session.status === "active") {
      throw new ServerActionError(
        "FORBIDDEN",
        "Cannot delete file during active upload session.",
      );
    }
    if (documentWithSession.processingStatus !== "pending") {
      throw new ServerActionError(
        "FORBIDDEN",
        "Cannot delete file from processing/processed document.",
      );
    }

    // We do soft delete.
    const deletedFile = await documentRepository.commands.updateFile(db, {
      documentId,
      fileId,
      delete: true,
    });

    if (!deletedFile) {
      throw new ServerActionError(
        "FAILED",
        "Delete could not be succesful. Try again.",
      );
    }

    return {
      documentId,
      fileId: deletedFile?.fileId,
    };
  }

  async updateDocument(
    userId: string,
    documentId: string,
    payload: { title?: string; description?: string },
  ): Promise<DocumentDTO> {
    const updatedDoc = await documentRepository.commands.update(db, {
      documentId: documentId,
      userId: userId,
      title: payload.title,
      description: payload.description,
    });

    if (!updatedDoc) {
      throw new ServerActionError(
        "NOT_FOUND",
        "Document not found or access denied.",
      );
    }

    return updatedDoc;
  }

  async getDocumentFileAccessUrl(
    userId: string,
    documentId: string,
    fileId: string,
    expiresIn = 3600,
  ): Promise<GetDocumentFileAccessUrlActionResponse> {
    const file = await documentRepository.queries.findFileById(db, fileId);

    if (!file) {
      throw new ServerActionError(
        "NOT_FOUND",
        "File not found or does not belong to this document.",
      );
    }

    const signedUrl = await supabaseStorageClient.getPageAccessUrl(
      file.storagePath,
      expiresIn,
    );

    return {
      fileId: file.id,
      filename: file.filename,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
      signedUrl,
    };
  }

  async processDocument(
    userId: string,
    documentId: string,
  ): Promise<ProcessDocumentActionResponse> {
    const document = await documentRepository.commands.update(db, {
      documentId: documentId,
      userId: userId,
      status: "queued",
    });

    if (!document) {
      throw new ServerActionError(
        "NOT_FOUND",
        "Document not found or access denied.",
      );
    }

    await inngest.send({
      name: PROCESS_DOCUMENT_EVENT_V2,
      data: {
        userId,
        documentId,
      },
    });

    return {
      documentId: document.documentId,
      processingStatus: document.processingStatus,
    };
  }

  /**
   * Single user document in the exact shape the documents list renders
   * (`DocumentSearchData`), so the detail view can reuse the list mappers.
   */
  async getUserDocument(
    userId: string,
    documentId: string,
  ): Promise<GetUserDocumentActionResponse> {
    const document = await documentRepository.queries.getUserDocument(
      db,
      userId,
      documentId,
    );

    if (!document) {
      throw new ServerActionError(
        "NOT_FOUND",
        "Document not found or access denied.",
      );
    }

    return { document };
  }

  /**
   * User documents with search keys, status filter and cursor pagination —
   * all fields optional; called with an empty payload it is simply "all of
   * this user's documents, newest first".
   *
   * Fetches `pageSize + 1` rows to decide `hasMore`, so pages never skip or
   * duplicate a record: `cursor` holds the exact ORDER BY key of the last
   * returned row and must be replayed with the same filters.
   */
  async searchUserDocuments(
    userId: string,
    searchQuery: DocumentSearchQueryPayload = {},
  ): Promise<DocumentSearchQueryResponse> {
    const pageSize = Math.min(
      Math.max(
        Math.round(
          searchQuery.pagination?.pageSize ??
            DocumentsService.DOCUMENTS_PAGE_SIZE,
        ),
        1,
      ),
      DocumentsService.MAX_DOCUMENTS_PAGE_SIZE,
    );

    const query = {
      searchKey: searchQuery.searchKey ?? "",
      processingStatus: searchQuery.processingStatus,
      pagination: {
        cursor: searchQuery.pagination?.cursor
          ? decodeSearchCursor(
              searchQuery.pagination.cursor,
              validateDocumentSearchCursor,
            )
          : undefined,
        pageSize,
      },
    };

    const data = await documentRepository.queries.searchUserDocuments(
      db,
      userId,
      query,
    );

    const hasMore = data.documents.length > query.pagination.pageSize;
    const items = hasMore
      ? data.documents.slice(0, query.pagination.pageSize)
      : data.documents;
    const lastItem = items[items.length - 1];

    return {
      documents: items,
      pagination: {
        cursor: lastItem
          ? encodeSearchCursor({
              createdAt: lastItem.createdAt,
              id: lastItem.documentId,
            })
          : "",
        hasMore: hasMore,
      },
    };
  }
}

export const documentsService = new DocumentsService();
