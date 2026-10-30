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
