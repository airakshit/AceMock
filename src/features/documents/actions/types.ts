import { SignedUrlResponseObject } from "../storage-service";
import {
  DocumentContentType,
  DocumentStatus,
  DocumentFileStatus,
  DocumentFileType,
} from "../types";

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
  contentType: DocumentContentType;
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
  originalFilename: string;
  mimeType: string;
  fileType: DocumentFileType;
  fileSize: number;
  status: DocumentFileStatus;
  storageUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentItemDTO {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  contentType: DocumentContentType;
  status: DocumentStatus;
  createdAt: Date;
  updatedAt: Date;
  files: DocumentFileDTO[];
}

export type GetUserDocumentsActionResponse = DocumentItemDTO[];
