import { SignedUrlResponseObject } from "../storage-service";
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
