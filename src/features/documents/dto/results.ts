import { SignedUrlResponseObject } from "@/features/shared/storage-service";
import {
  DocumentProcessingStatus,
  FileUploadStatus,
  UploadSessionStatus,
} from "../types";
import type {
  DocumentUploadSessionSearchData,
  DocumentSearchData,
  DocumentWithQuestionCountProjection,
  DocumentDTO,
} from "../dto/projections";
import { FileRecoveryAction } from "../types";

export interface CreateDocumentActionResponse {
  documentId: string;
  title: string;
  description?: string;
  processingStatus: string;
  createdAt: Date;

  // Session and file urls data.
  sessionId: string;
  signedFileUrls: SignedUrlResponseObject[];
}

export interface DocumentSearchQueryResponse {
  documents: DocumentSearchData[];
  pagination: {
    cursor: string;
    hasMore: boolean;
  };
}

export interface GetUserDocumentActionResponse {
  document: DocumentSearchData;
}

export interface SaveUploadReferenceActionResponse {
  fileId: string;
  sessionId: string;
  uploadStatus: FileUploadStatus;
}

export interface HeartbeatUploadSessionActionResponse {
  sessionId: string;
  lastHeartbeatAt: Date;
  /** recoveryExpiresAt of the session — lets the client show a countdown. */
  recoveryExpiresAt: Date;
  /** Whether the heartbeat was accepted or the recovery window elapsed. */
  accepted: boolean;
}

export interface GetUploadSessionStatusActionResponse {
  session: DocumentUploadSessionSearchData | null;
}

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
  reason: "no-session" | "session-terminal" | "session-expired" | null;
  files: DocumentFileRecoveryPlan[];
}

export interface CompleteDocumentFileUploadActionResponse {
  documentFileId: string;
  uploadStatus: FileUploadStatus;
}

export interface CompleteUploadSessionActionResponse {
  sessionId: string;
  status: UploadSessionStatus;
  // Files that could not be reconciled to "completed" — empty on success.
  unreconciledFiles: Array<{
    serverFileId: string;
    uploadStatus: FileUploadStatus;
  }>;
}

export type GetDocumentsSummaryActionResponse =
  DocumentWithQuestionCountProjection[];

export interface ProcessDocumentActionResponse {
  documentId: string;
  processingStatus: DocumentProcessingStatus;
}

export interface DeleteDocumentActionResponse {
  documentId: string;
}

export interface DeleteDocumentFileActionResponse {
  documentId: string;
  fileId: string;
}

export interface UpdateDocumentActionResponse {
  document: DocumentDTO;
}

export interface GetDocumentFileAccessUrlActionResponse {
  fileId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  signedUrl: string;
}
