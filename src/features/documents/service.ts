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
  GetDocumentsSummaryActionResponse,
  ProcessDocumentActionResponse,
  GetDocumentFileAccessUrlActionResponse,
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
  /** Default page size for the user documents search. */
  private static readonly DOCUMENTS_PAGE_SIZE = 20;
  /** Upper bound for `pageSize` — client-supplied values are clamped. */
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

  /**
   * Returns the latest session for the document.
   */
  private async getRelevantSession(
    documentId: string,
    userId: string,
  ): Promise<UploadSessionDTO | null> {
    const latest = await uploadSessionsRepository.findLatestByDocumentIdForUser(
      db,
      documentId,
      userId,
    );

    return latest ? this.toSessionDTO(latest) : null;
  }

  private requireVerifiedDocument(userId: string, documentId: string) {
    return documentRepository.queries.findByIdForUser(db, documentId, userId);
  }

  // =========================================================================
  // createDocument
  // =========================================================================

  /**
   * Creates the document, its files, AND its server-owned upload session —
   * one attempt, one session. Tokens are minted after the transaction
   * commits (a post-mint failure leaves a valid session; the client then
   * recovers via resumeDocumentUpload instead of duplicating the attempt).
   */
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

      await documentRepository.commands.createManyFiles(
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

      return { document: createdDoc, session: uploadSession };
    });

    const signedUrls = await supabaseStorageClient.getUploadSignedUrls(
      fileModels.map((f) => ({
        clientFileId: f.clientFileId,
        serverFileId: f.serverFileId,
        storagePath: f.storagePath,
      })),
    );

    return {
      documentId: data.document.documentId,
      title: data.document.title,
      description: data.document.description
        ? data.document.description
        : undefined,
      createdAt: data.document.createdAt,
      processingStatus: data.document.processingStatus,
      sessionId: data.session.id,
      signedFileUrls: signedUrls,
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
  ): Promise<GetUploadSessionStatusActionResponse> {
    const existingDocument = await this.requireVerifiedDocument(
      userId,
      documentId,
    );

    if (!existingDocument) {
      throw new ServerActionError(
        "NOT_FOUND",
        "Document not found or access denied.",
      );
    }

    return {
      session: await this.getRelevantSession(documentId, userId),
    };
  }

  // =========================================================================
  // resumeDocumentUpload — the server-side recovery algorithm
  // =========================================================================

  /**
   * THE recovery decision point. The client NEVER decides resume by itself
   * (no Uppy fingerprints are trusted): before returning a single byte of
   * instructions, this server action runs the recovery decision table —
   * including live HEAD probes of stored TUS resources — and returns a
   * per-file plan the client executes mechanically.
   */
  async resumeDocumentUpload(
    userId: string,
    payload: ResumeDocumentUploadActionPayload,
  ): Promise<ResumeDocumentUploadActionResponse> {
    const existingDocument = await this.requireVerifiedDocument(
      userId,
      payload.documentId,
    );

    if (!existingDocument) {
      throw new ServerActionError(
        "NOT_FOUND",
        "Document not found or access denied.",
      );
    }

    const session =
      await uploadSessionsRepository.findActiveByDocumentIdForUser(
        db,
        payload.documentId,
        userId,
      );

    // No session at all → nothing to resume; the caller starts a new attempt.
    if (!session) {
      const latest =
        await uploadSessionsRepository.findLatestByDocumentIdForUser(
          db,
          payload.documentId,
          userId,
        );

      return {
        document: {
          documentId: existingDocument.id,
          title: existingDocument.title,
          description: existingDocument.description,
        },
        sessionId: latest?.id ?? "",
        sessionStatus: latest?.status ?? "abandoned",
        recoveryExpiresAt: latest?.recoveryExpiresAt ?? new Date(0),
        canResume: false,
        reason: latest
          ? ("session-terminal" as const)
          : ("no-session" as const),
        files: [],
      };
    }

    if (session.status !== "active") {
      return {
        document: {
          documentId: existingDocument.id,
          title: existingDocument.title,
          description: existingDocument.description,
        },
        sessionId: session.id,
        sessionStatus: session.status,
        recoveryExpiresAt: session.recoveryExpiresAt,
        canResume: false,
        reason: "session-terminal",
        files: [],
      };
    }

    // Lazy expiry for ACTIVE sessions outside the recovery window.
    if (Date.now() > session.recoveryExpiresAt.getTime()) {
      await uploadSessionsRepository.updateStatus(db, {
        sessionId: session.id,
        status: "abandoned",
        endReason: "recovery-window-elapsed",
      });

      return {
        document: {
          documentId: existingDocument.id,
          title: existingDocument.title,
          description: existingDocument.description,
        },
        sessionId: session.id,
        sessionStatus: "abandoned",
        recoveryExpiresAt: session.recoveryExpiresAt,
        canResume: false,
        reason: "session-expired",
        files: [],
      };
    }

    const files = await documentRepository.queries.findFilesBySessionId(
      db,
      session.id,
    );

    // Only files with bytes still to move need re-authorized credentials.
    const transferTargets = files.filter(
      (f) => f.uploadStatus === "pending" || f.uploadStatus === "uploading",
    );

    const signedUrls = await supabaseStorageClient.getUploadSignedUrls(
      transferTargets.map((value) => ({
        clientFileId: value.id,
        serverFileId: value.id,
        storagePath: value.storagePath,
      })),
    );

    const tokensByFileId = new Map(
      signedUrls.map((s) => [s.serverFileId, s.token]),
    );
    const tusResourceExpiryCutoff =
      Date.now() - UPLOAD_TUS_RESOURCE_LIFETIME_MS;

    /**
     * Downloadable resources are validated with a live HEAD probe: the
     * stored reference is authoritative only if the provider still accepts
     * it. This is the "resource validity unknown → perform a supported
     * resource check" row of the recovery decision table.
     */
    const probes = await Promise.all(
      transferTargets.map(async (f) => {
        const hasFreshReference =
          f.uploadRef !== null &&
          f.uploadRef !== undefined &&
          (f.uploadRefCreatedAt?.getTime() ?? 0) > tusResourceExpiryCutoff;

        if (f.uploadStatus === "uploading" && hasFreshReference) {
          const token = tokensByFileId.get(f.id) ?? "";
          return {
            fileId: f.id,
            probe: await probeTusResource(f.uploadRef as string, token),
          };
        }

        return { fileId: f.id, probe: null };
      }),
    );

    const probeByFileId = new Map(probes.map((p) => [p.fileId, p.probe]));

    const plans: DocumentFileRecoveryPlan[] = files.map((f) => {
      const token = tokensByFileId.get(f.id) ?? null;
      const probe = probeByFileId.get(f.id);

      const action = decideFileRecoveryAction(
        {
          uploadStatus: f.uploadStatus,
          uploadRef: f.uploadRef,
          isReferenceWithinProviderLifetime:
            (f.uploadRefCreatedAt?.getTime() ?? 0) > tusResourceExpiryCutoff,
        },
        probe ?? null,
      );

      return {
        serverFileId: f.id,
        filename: f.filename,
        mimeType: f.mimeType,
        fileSize: f.fileSize,
        storagePath: f.storagePath,
        contentProbe: f.contentProbe ?? null,
        uploadStatus: f.uploadStatus,
        action,
        token: action === "skip" ? null : token,
        uploadRef: action === "resume" ? (f.uploadRef ?? null) : null,
        offsetBytes:
          action === "resume" && probe?.ok ? probe.offsetBytes : null,
      };
    });

    // A resume is a liveness signal in itself — don't let the recovery
    // window expire while the client is actively picking up instructions.
    await uploadSessionsRepository.touchHeartbeat(db, {
      sessionId: session.id,
    });

    return {
      document: {
        documentId: existingDocument.id,
        title: existingDocument.title,
        description: existingDocument.description,
      },
      sessionId: session.id,
      sessionStatus: session.status,
      recoveryExpiresAt: session.recoveryExpiresAt,
      canResume: true,
      reason: null,
      files: plans,
    };
  }

  /**
   * Commits a session ONLY after every file of the session is out of
   * transfer. Storage verification runs first: each `uploaded` file must
   * actually exist in the bucket (clients may claim completion without
   * the bytes being durable). Unverifiable files are demoted to `failed`
   * and reported back — the session stays open for recovery.
   */
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
        cursor: encodeSearchCursor({
          createdAt: lastItem.createdAt,
          id: lastItem.documentId,
        }),
        hasMore: hasMore,
      },
    };
  }
}

export const documentsService = new DocumentsService();
