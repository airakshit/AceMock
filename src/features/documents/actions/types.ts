import { SignedUrlResponseObject } from "@/features/shared/storage-service";
import { DocumentProcessingStatus, FileUploadStatus, UploadSessionStatus } from "../types";
import type { DocumentWithQuestionCountProjection } from "../dto/projections";
import type { FileRecoveryAction } from "../uploads/recovery-decision";

export type { FileRecoveryAction };

interface UserIdInterface {
  userId: string;
}

// ===========================================================================
// createDocument
// ===========================================================================

/**
 * One selected file, as declared up-front by the client.
 * `contentProbe` is the client-computed content fingerprint
 * (SHA-256 over size + first/last 256KiB — see UploadFlow.md §probe).
 */
interface UploadFilePayload {
  clientFileId: string;
  name: string;
  size: number;
  type: string;
  contentProbe: string;
}

export interface CreateDocumentActionPayload {
  title: string;
  description?: string;
  pdfs: UploadFilePayload[];
  images: UploadFilePayload[];
}

export interface CreateDocumentActionResponse {
  documentId: string;
  /** Server-owned upload session created for this attempt. */
  sessionId: string;
  files: SignedUrlResponseObject[];
}


export interface SaveUploadReferenceActionPayload {
  sessionId: string;
  documentFileId: string;
  /** The TUS upload URL the client's TUS session created. */
  uploadRef: string;
}

export interface SaveUploadReferenceActionResponse {
  documentFileId: string;
  uploadStatus: FileUploadStatus;
}

// ===========================================================================
// heartbeatUploadSession — server-side liveness
// ===========================================================================

export interface UploadHeartbeatFileProgress {
  documentFileId: string;
  status: FileUploadStatus;
  /** Last known confirmed byte offset in the TUS resource, when known. */
  offsetBytes?: number;
}

export interface HeartbeatUploadSessionActionPayload {
  sessionId: string;
  files?: UploadHeartbeatFileProgress[];
}

export interface HeartbeatUploadSessionActionResponse {
  sessionId: string;
  lastHeartbeatAt: Date;
  /** recoveryExpiresAt of the session — lets the client show a countdown. */
  recoveryExpiresAt: Date;
  /** Whether the heartbeat was accepted or the recovery window elapsed. */
  accepted: boolean;
}

// ===========================================================================
// getUploadSessionStatus
// ===========================================================================

export interface UploadSessionDTO {
  id: string;
  documentId: string;
  status: UploadSessionStatus;
  lastHeartbeatAt: Date;
  recoveryExpiresAt: Date;
}

export interface GetUploadSessionStatusActionPayload {
  documentId: string;
}

export interface GetUploadSessionStatusActionResponse {
  session: UploadSessionDTO | null;
}

// ===========================================================================
// resumeDocumentUpload — the server-side recovery algorithm
// ===========================================================================

export interface ResumeDocumentUploadActionPayload {
  documentId: string;
}

/**
 * Per-file recovery decision, computed SERVER-SIDE (the client never
 * decides resume by itself — Uppy fingerprints are not trusted).
 * The union lives in ../uploads/recovery-decision (pure, shared with tests).
 */

export interface DocumentFileRecoveryPlan {
  serverFileId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  /** Server-side expectation for content verification of re-selected files. */
  contentProbe: string | null;
  uploadStatus: FileUploadStatus;
  action: FileRecoveryAction;
  /** Present for `resume`/`reupload` — a fresh, short-lived signed token. */
  token: string | null;
  /** Present for `resume` — the existing TUS resource URL to continue. */
  uploadRef: string | null;
  /** Present for `resume` — server-confirmed byte offset of the resource. */
  offsetBytes: number | null;
}

export interface ResumeDocumentUploadActionResponse {
  document: {
    documentId: string;
    title: string;
    description: string | null;
  };
  sessionId: string;
  sessionStatus: UploadSessionStatus;
  recoveryExpiresAt: Date;
  canResume: boolean;
  /** Populated when canResume=false — why. */
  reason:
    | "no-session"
    | "session-terminal"
    | "session-expired"
    | null;
  files: DocumentFileRecoveryPlan[];
}

// ===========================================================================
// completeDocumentFileUpload / completeUploadSession / cancel
// ===========================================================================

export interface CompleteDocumentFileUploadActionPayload {
  sessionId: string;
  documentFileId: string;
}

export interface CompleteDocumentFileUploadActionResponse {
  documentFileId: string;
  uploadStatus: FileUploadStatus;
}

export interface CompleteUploadSessionActionPayload {
  sessionId: string;
}

export interface CompleteUploadSessionActionResponse {
  sessionId: string;
  status: UploadSessionStatus;
  // Files that could not be reconciled to "completed" — empty on success.
  unreconciledFiles: Array<{ serverFileId: string; uploadStatus: FileUploadStatus }>;
}

export interface CancelUploadSessionActionPayload {
  sessionId: string;
}

export interface CancelUploadSessionActionResponse {
  sessionId: string;
  status: UploadSessionStatus;
}

// ===========================================================================
// Shared DTOs
// ===========================================================================

export interface DocumentFileDTO {
  id: string;
  documentId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  uploadStatus: FileUploadStatus;
  createdAt: Date;
}

export interface DocumentItemDTO {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  processingStatus: DocumentProcessingStatus;
  createdAt: Date;
  updatedAt: Date;
  session: UploadSessionDTO | null;
  files: DocumentFileDTO[];
}

export type GetUserDocumentsActionResponse = DocumentItemDTO[];

/**
 * Picker list of the caller's own documents with per-document question counts.
 * Returned by `getDocumentsSummaryAction` for both admin and student
 * mock-test creation.
 */
export type GetDocumentsSummaryActionResponse =
  DocumentWithQuestionCountProjection[];

export interface ProcessDocumentActionPayload {
  documentId: string;
}

export interface ProcessDocumentActionResponse {
  document: DocumentItemDTO;
  message: string;
}

export interface GetDocumentStatusActionPayload {
  documentId: string;
}

export interface GetDocumentStatusActionResponse {
  document: DocumentItemDTO;
}

export interface DeleteDocumentActionPayload {
  documentId: string;
}

export interface DeleteDocumentActionResponse {
  documentId: string;
}

export interface DeleteDocumentFileActionPayload {
  documentId: string;
  fileId: string;
}

export interface DeleteDocumentFileActionResponse {
  documentId: string;
  fileId: string;
}

export interface UpdateDocumentActionPayload {
  documentId: string;
  title: string;
  description?: string;
}

export interface UpdateDocumentActionResponse {
  document: DocumentItemDTO;
}

export interface GetDocumentFileAccessUrlActionPayload {
  documentId: string;
  fileId: string;
}

export interface GetDocumentFileAccessUrlActionResponse {
  fileId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  signedUrl: string;
}

/** Unused legacy alias retained for call-site compatibility. */
export type { UserIdInterface };
