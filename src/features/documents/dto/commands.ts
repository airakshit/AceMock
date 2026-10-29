// Database write models consumed by repository insert/update operations
// Accessed by: services and repositories

import {
  DocumentProcessingStatus,
  FileProcessingStatus,
  FilePageOCRStatus,
} from "../types";

// ===========================================================================
// Upload sessions
// ===========================================================================

export interface CreateUploadSessionCommand {
  id: string;
  userId: string;
  documentId: string;
  /** Absolute deadline after which the attempt can no longer be resumed. */
  recoveryExpiresAt: Date;
}

export interface UpdateUploadSessionStatusCommand {
  sessionId: string;
  status: "completed" | "abandoned" | "cancelled";
  endReason?: string;
}

export interface TouchUploadSessionCommand {
  sessionId: string;
  /** Optional per-file progress snapshot (documentFileId → state). */
  progress?: Record<string, unknown>;
}

// ===========================================================================
// Document files & uploads
// ===========================================================================

export interface CreateDocumentCommand {
  documentId: string;
  userId: string;
  title: string;
  description?: string;
}

export interface CreateDocumentFileCommand {
  id: string;
  documentId: string;
  /** Upload session that owns this in-flight upload. */
  sessionId?: string | null;
  /** Content fingerprint of the selected file (client-computed). */
  contentProbe?: string | null;
  filename: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
}

export interface UpdateDocumentCommand {
  documentId: string;
  userId: string;
  title?: string;
  description?: string;
  status?: DocumentProcessingStatus;
}

export interface UpdateDocumentFileCommand {
  fileId: string;
  documentId: string;
  filename?: string;
  mimeType?: string;
  fileSize?: number;
  storagePath?: string;
  uploadStatus?: "uploading" | "uploaded" | "failed";
}

export interface UpdateDocumentFileProcessingStatusCommand {
  documentId: string;
  status: FileProcessingStatus;
}

export interface UpdateFilesUploadStatusCommand {
  documentId: string;
  /** Files whose uploadStatus should be flipped. */
  fileIds: string[];
  uploadStatus:
    | "pending"
    | "uploading"
    | "uploaded"
    | "failed"
    | "cancelled"
    | "expired";
}

export interface SaveUploadReferenceCommand {
  fileId: string;
  documentId: string;
  /** TUS upload resource URL created by the client. */
  uploadRef: string;
}

export interface ReconcileVerifiedFilesCommand {
  documentId: string;
  verifiedFileIds: string[];
  failedFileIds: string[];
}

// ===========================================================================
// File pages
// ===========================================================================

export interface CreateFilePageCommand {
  id: string;
  fileId: string;
  pageNo: number;
}

export interface UpdateFilePageCommand {
  pageId: string;
  fileId: string;
  pageNo: number;
  ocrText?: string;
  ocrStatus?: FilePageOCRStatus;
  survivedValidation?: boolean;
  ocrModel?: string;
  isRelevant?: boolean;
  /**
   * Internal only: which inngest function version produced this page's
   * data. Never surfaced to users.
   */
  fnVersion?: number;
}

export interface UpdateFilePageStatusCommand {
  fileId: string;
  ocrStatus: FilePageOCRStatus;
}

export interface UpdateFilePageStatusByPageIdCommand {
  pageId: string;
  ocrStatus: FilePageOCRStatus;
}

export interface UpdateFilePagesStatusCommand {
  fileId: string;
  pageIds: string[];
  status: FilePageOCRStatus;
}

// ===========================================================================
// Deletions
// ===========================================================================

export interface DeleteDocumentCommand {
  documentId: string;
  userId: string;
}

export interface DeleteDocumentFileCommand {
  fileId: string;
  documentId: string;
}

export interface DeleteFilePageCommand {
  pageId: string;
  fileId: string;
}
