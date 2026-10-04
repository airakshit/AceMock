// Database write models consumed by repository insert/update operations
// Accessed by: services and repositories

import { DocumentProcessingStatus } from "../types";

export type FileUploadStatus = "uploading" | "uploaded" | "failed";
export type FileProcessingStatus = "pending" | "running" | "completed" | "failed";
export type FilePageOCRStatus = "pending" | "running" | "completed" | "failed";

export interface CreateDocumentCommand {
  documentId: string;
  userId: string;
  title: string;
  description?: string;
}

export interface CreateDocumentFileCommand {
  id: string;
  documentId: string;
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
  uploadStatus?: FileUploadStatus;
}

export interface UpdateDocumentFileProcessingStatusCommand {
  documentId: string;
  status: FileProcessingStatus;
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
}

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

export interface CreateFilePageCommand {
  id: string;
  fileId: string;
  pageNo: number;
}