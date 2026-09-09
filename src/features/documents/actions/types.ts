import { SignedUrlResponseObject } from "@/features/shared/storage-service";
import { FileUploadStatus } from "../types";

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
  createdAt: Date;
  updatedAt: Date;
  files: DocumentFileDTO[];
}

export type GetUserDocumentsActionResponse = DocumentItemDTO[];

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
