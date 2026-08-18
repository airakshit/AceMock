import { DocumentContentType } from "../types";
import { documents, documentFiles } from "@/db/schemas";

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
    document: typeof documents.$inferSelect;
    files: Array<typeof documentFiles.$inferSelect>;
}
