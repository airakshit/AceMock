import { SignedUrlResponseObject } from "@/features/shared/storage-service";
import { DocumentProcessingStatus, FileUploadStatus } from "../types";
import type { DocumentWithQuestionCountProjection } from "../dto/projections";

interface UserIdInterface {
  userId: string;
}

interface FilePayload {
  clientFileId: string;
  name: string;
  size: number;
  type: string;
}

export interface CreateNewDocumentActionPayload {
  title: string;
  description?: string;
  pdfs: FilePayload[];
  images: FilePayload[];
}
export interface CreateNewDocumentActionResponse {
  documentId: string;
  files: SignedUrlResponseObject[];
}

export interface FinalizeDocumentUploadActionPayload {
  documentId: string;
  fileIds: string[];
}

export interface FinalizeDocumentUploadActionResponse {
  fileIds: string[];
}
export type FinalizeDocumentUplaodActionResponse =
  FinalizeDocumentUploadActionResponse;

export interface DocumentFileDTO {
  id: string;
  documentId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  uploadStatus: FileUploadStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentItemDTO {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  processingStatus: DocumentProcessingStatus;
  createdAt: Date;
  updatedAt: Date;
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
