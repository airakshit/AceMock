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
  DocumentFileSearchData,
} from "../dto/projections";
import { FileRecoveryAction } from "../types";

export interface DocumentFileWithSignedUrls
  extends SignedUrlResponseObject, DocumentFileSearchData {}

export interface CreateDocumentActionResponse {
  documentId: string;
  title: string;
  description: string | null;
  processingStatus: string;
  createdAt: Date;

  session: DocumentUploadSessionSearchData;
  files: DocumentFileWithSignedUrls[];
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

export type GetUploadSessionStatusActionResponse =
  DocumentUploadSessionSearchData | null;

export interface ToUploadFilesResponse {
  fileId: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  contentProbe: string | null;
  storagePath: string;
  uploadRef: string;
  token: string; // The signed token for upload from supabase
  uploadStatus: FileUploadStatus;
}

export interface ResumeDocumentUploadActionResponse {
  documentId: string;
  sessionId: string;
  sessionStatus: UploadSessionStatus;
  recoveryExpiresAt: Date;
  toUploadFiles: ToUploadFilesResponse;
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
