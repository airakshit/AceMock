import { db } from "@/db";
import {
  CreateDocumentActionPayload,
  CreateDocumentActionResponse,
  SaveUploadReferenceActionPayload,
  SaveUploadReferenceActionResponse,
  HeartbeatUploadSessionActionPayload,
  HeartbeatUploadSessionActionResponse,
  GetUploadSessionStatusActionResponse,
  UploadSessionDTO,
  ResumeDocumentUploadActionPayload,
  ResumeDocumentUploadActionResponse,
  DocumentFileRecoveryPlan,
  CompleteDocumentFileUploadActionPayload,
  CompleteDocumentFileUploadActionResponse,
  CompleteUploadSessionActionPayload,
  CompleteUploadSessionActionResponse,
  CancelUploadSessionActionPayload,
  CancelUploadSessionActionResponse,
  DocumentFileDTO,
  DocumentItemDTO,
} from "./actions/types";
import { documentsRepository } from "./repositories/documents.repository";
import {
  uploadSessionsRepository,
  type UploadSessionRow,
} from "./repositories/upload-sessions.repository";
import type {
  DocumentWithQuestionCountProjection,
  DocumentWithFilesProjection,
} from "./dto/projections";
import { documentQueries } from "./repositories/document-queries";
import { storagePaths } from "@/lib/supabase/storage-paths";
import { generateUUIDv7 } from "../shared/utils";
import { supabaseStorageClient } from "../shared/storage-service";
import { ServerActionError } from "../shared/actions/error";
import { inngest } from "@/inngest/client";
import { EXTRACT_QUESTIONS_EVENT } from "@/inngest/functions/v1/extract-questions/func";
import { FileUploadStatus } from "./types";
import { decideFileRecoveryAction } from "./uploads/recovery-decision";
import { documentFiles } from "@/db/schemas";
import { and, eq } from "drizzle-orm";
import { probeTusResource } from "@/lib/supabase/tus-probe";
import {
  UPLOAD_RECOVERY_WINDOW_MS,
  UPLOAD_TUS_RESOURCE_LIFETIME_MS,
} from "./uploads/upload-session-constants";

class DocumentsService {
  // =========================================================================
  // Session lifecycle helpers
  // =========================================================================

  private toSessionDTO(session: UploadSessionRow): UploadSessionDTO {
    return {
      id: session.id,
      documentId: session.documentId,
      status: session.status,
      lastHeartbeatAt: session.lastHeartbeatAt,
      recoveryExpiresAt: session.recoveryExpiresAt,
    };
  }

  private toFileDTO(
    file: DocumentWithFilesProjection["files"][number],
  ): DocumentFileDTO {
    return {
      id: file.id,
      documentId: file.documentId,
      filename: file.filename,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
      storagePath: file.storagePath,
      uploadStatus: file.uploadStatus,
      createdAt: file.createdAt,
    };
  }

  /**
   * The one document-related session surfaced to clients: the ACTIVE one
   * when present, otherwise the most recent terminal session (for status).
   * Terminal sessions are never surfaced as resumable.
   */
  private async getRelevantSession(
    documentId: string,
    userId: string,
  ): Promise<UploadSessionDTO | null> {
    const active = await uploadSessionsRepository.findActiveByDocumentIdForUser(
      db,
      documentId,
      userId,
    );

    if (active) {
      return this.toSessionDTO(active);
    }

    const latest = await uploadSessionsRepository.findLatestByDocumentIdForUser(
      db,
      documentId,
      userId,
    );

    return latest ? this.toSessionDTO(latest) : null;
  }

  private requireVerifiedDocument(userId: string, documentId: string) {
    return documentsRepository.findByIdForUser(db, documentId, userId);
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

    const allPayloadFiles = [...payload.pdfs, ...payload.images];

    if (allPayloadFiles.length === 0) {
      throw new ServerActionError("BAD_REQUEST", "No files to upload.");
    }

    const fileModels = allPayloadFiles.map((file) => {
      const documentFileId = generateUUIDv7();
      return {
        clientFileId: file.clientFileId,
        serverFileId: documentFileId,
        contentProbe: file.contentProbe,
        filename: file.name,
        mimeType: file.type,
        fileSize: file.size,
        storagePath: storagePaths.getDocumentFileSourceUrl(
          userId,
          documentId,
          documentFileId,
          file.name,
        ),
      };
    });

    /**
     * One transaction = one attempt: document + files (bound to the session
     * id and content probes) + the ACTIVE session row itself. The partial
     * unique index `uq_active_upload_session_per_document` guarantees a
     * racing attempt for the same document cannot create a second session.
     */
    await db.transaction(async (tx) => {
      await documentsRepository.create(tx, {
        documentId: documentId,
        userId,
        title: payload.title,
        description: payload.description,
      });

      // Session is created first because, files require the id.
      await uploadSessionsRepository.create(tx, {
        id: sessionId,
        userId,
        documentId,
        recoveryExpiresAt,
      });

      await documentsRepository.createManyFiles(
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
    });

    // Tokens minted after commit. If this fails the session still exists,
    // so the client recovers through resumeDocumentUpload (there is exactly
    // one source of truth — the session, not local blobs/fingerprints).
    const signedUrls = await supabaseStorageClient.getUploadSignedUrls(
      fileModels.map((f) => ({
        clientFileId: f.clientFileId,
        serverFileId: f.serverFileId,
        storagePath: f.storagePath,
      })),
    );

    return {
      documentId,
      sessionId,
      files: signedUrls,
    };
  }

  // =========================================================================
  // saveUploadReference
  // =========================================================================

  /**
   * The client's TUS session created an upload resource for a file — the
   * server persists the reference so that ONLY the server (never a local
   * fingerprint) decides resume eligibility later. Transitions the file
   * `pending → uploading`.
   */
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

    const file = await db
      .select()
      .from(documentFiles)
      .where(
        and(
          eq(documentFiles.id, payload.documentFileId),
          eq(documentFiles.documentId, session.documentId),
          eq(documentFiles.sessionId, session.id),
        ),
      )
      .limit(1);

    if (!file[0]) {
      throw new ServerActionError(
        "NOT_FOUND",
        "File not found in this upload session.",
      );
    }

    const updated = await documentsRepository.saveUploadReference(db, {
      fileId: payload.documentFileId,
      documentId: session.documentId,
      uploadRef: payload.uploadRef,
    });

    if (!updated) {
      throw new ServerActionError(
        "CONFLICT",
        "File is not in a transferable state (pending/uploading).",
      );
    }

    return {
      documentFileId: updated.id,
      uploadStatus: updated.uploadStatus,
    };
  }

  // =========================================================================
  // heartbeatUploadSession
  // =========================================================================

  /**
   * Client liveness heartbeat (every 25s while the coordinator runs).
   *
   * Accepts an optional per-file progress snapshot, which also doubles as
   * the "dead pipeline" detection signal on the server (heartbeats cannot
   * keep an abandoned session alive indefinitely: the recovery window is
   * absolute; and the Inngest job reclaims sessions the client vanished
   * from, since its heartbeats stop).
   */
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

  // =========================================================================
  // getUploadSessionStatus
  // =========================================================================

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

    const files = await documentsRepository.findFilesBySessionId(
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
        token: action === "skip" || action === "verify-commit" ? null : token,
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

  // =========================================================================
  // completeDocumentFileUpload
  // =========================================================================

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
    const updated = await documentsRepository.updateFilesUploadStatus(db, {
      documentId: session.documentId,
      fileIds: [payload.documentFileId],
      uploadStatus: "uploaded",
    });

    if (!updated.some((f) => f.id === payload.documentFileId)) {
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

    const files = await documentsRepository.findFilesBySessionId(
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

    await documentsRepository.reconcileVerifiedFiles(db, {
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
   * Explicit, idempotent user cancellation. Terminal immediately; partial
   * TUS resources of in-flight files are cleaned up best-effort. Fully
   * uploaded files of a cancelled attempt keep their bytes in storage
   * (deleting verified user data on cancel would be destructive); the
   * attempt simply ends without ever committing the document processing.
   */
  async cancelUploadSession(
    userId: string,
    payload: CancelUploadSessionActionPayload,
  ): Promise<CancelUploadSessionActionResponse> {
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

    // Idempotent: cancelling a terminal session is a no-op.
    if (session.status === "active") {
      const files = await documentsRepository.findFilesBySessionId(
        db,
        session.id,
      );

      // Flip in-flight files to cancelled, then clean up their partial data.
      const inFlight = files.filter(
        (f) => f.uploadStatus === "pending" || f.uploadStatus === "uploading",
      );

      if (inFlight.length > 0) {
        await documentsRepository.updateFilesUploadStatus(db, {
          documentId: session.documentId,
          fileIds: inFlight.map((f) => f.id),
          uploadStatus: "cancelled",
        });
      }

      // Safe cleanup: only folders of files that never finished transferring.
      await Promise.all(
        inFlight.map(async (f) => {
          try {
            await supabaseStorageClient.deleteFolder(
              `user/${userId}/documents/${session.documentId}/files/${f.id}`,
            );
          } catch (storageError) {
            // Cleanup is best-effort; the storage sweep covers orphans.
            console.error(
              `Failed to clean partial upload for file ${f.id}:`,
              storageError,
            );
          }
        }),
      );

      await uploadSessionsRepository.updateStatus(db, {
        sessionId: session.id,
        status: "cancelled",
        endReason: "user-cancelled",
      });
    }

    return {
      sessionId: session.id,
      status: "cancelled",
    };
  }

  async getUserDocuments(userId: string): Promise<DocumentItemDTO[]> {
    const docs = await documentsRepository.findByUserWithFiles(db, userId);

    return Promise.all(
      docs.map(async (doc) => this.toDocumentItemDTO(doc.id, userId, doc)),
    );
  }

  /**
   * Projection → client DTO conversion, always attaching the document's
   * relevant upload session (active if one exists, else most recent).
   */
  private async toDocumentItemDTO(
    _documentId: string,
    userId: string,
    doc: DocumentWithFilesProjection,
  ): Promise<DocumentItemDTO> {
    return {
      id: doc.id,
      userId: doc.userId,
      title: doc.title,
      description: doc.description,
      processingStatus: doc.processingStatus,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      session: await this.getRelevantSession(doc.id, userId),
      files: doc.files.map((f) => this.toFileDTO(f)),
    };
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
      document: await this.toDocumentItemDTO(updatedDoc.id, userId, updatedDoc),
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
      document: await this.toDocumentItemDTO(updatedDoc.id, userId, updatedDoc),
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
      document: await this.toDocumentItemDTO(document.id, userId, document),
    };
  }
}

export const documentsService = new DocumentsService();
