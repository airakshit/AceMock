import { DocumentProcessingStatus, FileUploadStatus } from "../types";

interface UploadFilePayload {
  clientFileId: string;
  name: string;
  size: number;
  mimeType: string;
  contentProbe: string;
}

export interface CreateDocumentActionPayload {
  title: string;
  description?: string;
  files: UploadFilePayload[];
}

export interface DocumentSearchQueryPayload {
  searchKey?: string;
  processingStatus?: DocumentProcessingStatus;
  pagination?: {
    cursor?: string;
    pageSize?: number;
  };
}

export interface SaveUploadReferenceActionPayload {
  sessionId: string;
  documentFileId: string;
  /** The TUS upload URL the client's TUS session created. */
  uploadRef: string;
}

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

export interface GetUploadSessionStatusActionPayload {
  documentId: string;
}

export interface ResumeDocumentUploadActionPayload {
  documentId: string;
}

export interface CompleteDocumentFileUploadActionPayload {
  sessionId: string;
  documentFileId: string;
}

export interface CompleteUploadSessionActionPayload {
  sessionId: string;
}

export interface ProcessDocumentActionPayload {
  documentId: string;
}

export interface GetUserDocumentActionPayload {
  documentId: string;
}

export interface DeleteDocumentActionPayload {
  documentId: string;
}

export interface DeleteDocumentFileActionPayload {
  documentId: string;
  fileId: string;
}

export interface UpdateDocumentActionPayload {
  documentId: string;
  title: string;
  description?: string;
}

export interface GetDocumentFileAccessUrlActionPayload {
  documentId: string;
  fileId: string;
}
