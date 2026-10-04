// Read models returned by repositories for queries
// Accessed by: repositories and services

import { DocumentProcessingStatus } from "../types";

export type FileUploadStatus = "uploading" | "uploaded" | "failed";
export type FileProcessingStatus = "pending" | "running" | "completed" | "failed";
export type FilePageOCRStatus = "pending" | "running" | "completed" | "failed";

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
 * Read model projection for a document file.
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
  updatedAt: Date;
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
  updatedAt: Date;
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