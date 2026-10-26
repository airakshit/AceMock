// Read models returned by repositories for queries
// Accessed by: repositories and services

import {
  DocumentProcessingStatus,
  FilePageOCRStatus,
  FileProcessingStatus,
  FileUploadStatus,
  UploadSessionStatus,
} from "../types";

/**
 * Read model for mock test creation - document options with question count.
 * Used by the mocks feature.
 */
export interface DocumentOptionForMockProjection {
  id: string;
  title: string;
  createdAt: Date;
  questionCount: number;
}

/**
 * Per-file progress snapshot cached on the session row (jsonb).
 * Kept narrow (no `unknown`) so projections stay JSON-mappable downstream
 * (e.g. Inngest step serialization via JsonifyObject).
 */
export interface UploadFileProgressSnapshot {
  status: FileUploadStatus;
  offsetBytes: number | null;
}

export type UploadSessionProgressSnapshot = Record<
  string,
  UploadFileProgressSnapshot
>;

/**
 * Read model projection for a document upload session.
 */
export interface UploadSessionProjection {
  id: string;
  documentId: string;
  userId: string;
  status: UploadSessionStatus;
  /** Last heartbeat accepted from the uploading client. */
  lastHeartbeatAt: Date;
  /** Absolute deadline after which the attempt can no longer be resumed. */
  recoveryExpiresAt: Date;
  /** Optional cached per-file progress (documentFileId → state). */
  progress: UploadSessionProgressSnapshot | null;
  createdAt: Date;
  endedAt: Date | null;
  endReason: string | null;
}

/**
 * Read model projection for a document file. Fields in the "upload
 * bookkeeping" group are needed by recovery/reconciliation logic, not by
 * the wider UI (DTOs are curated in ../actions/types).
 */
export interface DocumentFileProjection {
  id: string;
  documentId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  uploadStatus: FileUploadStatus;
  processingStatus: FileProcessingStatus;
  createdAt: Date;

  // ---- upload bookkeeping ----
  sessionId: string | null;
  contentProbe: string | null;
  uploadRef: string | null;
  uploadRefCreatedAt: Date | null;
}

/**
 * Read model projection for a file page.
 */
export interface FilePageProjection {
  id: string;
  fileId: string;
  pageNo: number;
  ocrText: string | null;
  ocrStatus: FilePageOCRStatus;
  survivedValidation: boolean | null;
  ocrModel: string | null;
  isRelevant: boolean | null;
  createdAt: Date;
}

/**
 * Read model projection for documents with aggregated question count.
 * Used by repository read queries such as `findRecentDocumentsWithQuestions`.
 */
export interface DocumentWithQuestionCountProjection {
  id: string;
  title: string;
  createdAt: Date;
  questionCount: number;
}

/**
 * Read model projection for a document with its files and pages.
 * `session` is the document's only relevant upload session (the active
 * one when one exists, otherwise the most recent terminal session for
 * status display; never both).
 */
export interface DocumentWithFilesProjection {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  processingStatus: DocumentProcessingStatus;
  createdAt: Date;
  updatedAt: Date;
  files: Array<DocumentFileProjection & { pages: FilePageProjection[] }>;
  session: UploadSessionProjection | null;
}

/**
 * Read model projection for a document (basic, without files).
 */
export interface DocumentProjection {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  processingStatus: DocumentProcessingStatus;
  createdAt: Date;
  updatedAt: Date;
}
