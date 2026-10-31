import z from "zod";
import {
  DocumentSearchSchema,
  DocumentFileSearchSchema,
  DocumentUploadSessionSearchSchema,
  DocumentSearchCursorSchema,
} from "../schemas/pagination";
import {
  DocumentProcessingStatus,
  FilePageOCRStatus,
  FileProcessingStatus,
  FileUploadStatus,
} from "../types";
import {
  documents,
  documentFiles,
  filePages,
  uploadSessions,
} from "@/db/schemas";

// Pagination read models
export type DocumentSearchCursor = z.infer<typeof DocumentSearchCursorSchema>;
export type DocumentFileSearchData = z.infer<typeof DocumentFileSearchSchema>;
export type DocumentUploadSessionSearchData = z.infer<
  typeof DocumentUploadSessionSearchSchema
>;
export type DocumentSearchData = z.infer<typeof DocumentSearchSchema>;

export interface DocumentDTO {
  documentId: string;
  title: string;
  description: string | null;
  processingStatus: DocumentProcessingStatus;
  createdAt: Date;
}
export type DocumentFileDTO = DocumentSearchData["files"][0];

export type UploadSessionDTO = DocumentSearchData["session"];

export interface SingleDocumentFileAndSessionProjection {
  documentId: string;
  title: string;
  description: string | null;
  processingStatus: DocumentProcessingStatus;
  createdAt: Date;
  file: DocumentFileSearchData;
  session: DocumentUploadSessionSearchData;
}

export interface DocumentWithFilesDTO {
  documentId: string;
  title: string;
  description: string | null;
  processingStatus: DocumentProcessingStatus;
  createdAt: Date;
  files: DocumentSearchData["files"];
}

export interface DocumentSearchProjection {
  documents: DocumentSearchData[];
}

export type DocumentWithPagesDTO = Omit<DocumentWithFilesDTO, "files"> & {
  files: Array<DocumentFileDTO & { pages: FilePageProjection[] }>;
};

/**
 * Internal-only read model for the document-processing pipeline. Carries
 * `storagePath`, deliberately excluded from the user-facing `DocumentFileDTO`
 * (search results never expose storage paths).
 */
export interface DocumentFileProcessingRow {
  id: string;
  filename: string;
  mimeType: string;
  storagePath: string;
  processingStatus: FileProcessingStatus;
}

export interface UploadFileProgressSnapshot {
  status: FileUploadStatus;
  offsetBytes: number | null;
}

export type UploadSessionProgressSnapshot = Record<
  string,
  UploadFileProgressSnapshot
>;

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

export interface DocumentWithQuestionCountProjection {
  id: string;
  title: string;
  createdAt: Date;
  questionCount: number;
}

// Returning object that matches with the existing DTOs

export const documentDTOReturning = {
  documentId: documents.id,
  title: documents.title,
  description: documents.description,
  processingStatus: documents.processingStatus,
  createdAt: documents.createdAt,
};

export const documentFileDTOReturning = {
  fileId: documentFiles.id,
  filename: documentFiles.filename,
  size: documentFiles.fileSize,
  mimeType: documentFiles.mimeType,
  uploadStatus: documentFiles.uploadStatus,
  contentProbe: documentFiles.contentProbe,
  storagePath: documentFiles.storagePath,
};

export const filePageProjectionReturning = {
  id: filePages.id,
  fileId: filePages.fileId,
  pageNo: filePages.pageNo,
  ocrText: filePages.ocrText,
  ocrStatus: filePages.ocrStatus,
  survivedValidation: filePages.survivedValidation,
  ocrModel: filePages.ocrModel,
  isRelevant: filePages.isRelevant,
  createdAt: filePages.createdAt,
};

export const uploadSessionDTOReturning = {
  sessionId: uploadSessions.id,
  status: uploadSessions.status,
  lastHeartbeatAt: uploadSessions.lastHeartbeatAt,
  recoveryExpiresAt: uploadSessions.recoveryExpiresAt,
  progress: uploadSessions.progress,
};
