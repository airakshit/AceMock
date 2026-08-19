import { SignedUrlResponseObject } from "../storage-service";
import { DocumentContentType } from "../types";

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
    files: SignedUrlResponseObject[]
}
