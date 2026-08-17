import {
    documentFileTypeEnum,
    documentStatusEnum,
    documentFileStatusEnum,
    documentPageStatusEnum,
    documentContentTypeEnum,
    documents,
    documentFiles,
} from "@/db/schemas";

export type DocumentStatus = (typeof documentStatusEnum.enumValues)[number];

export type DocumentFileType = (typeof documentFileTypeEnum.enumValues)[number];

export type DocumentFileStatus =
    (typeof documentFileStatusEnum.enumValues)[number];

export type DocumentPageStatus =
    (typeof documentPageStatusEnum.enumValues)[number];

export type DocumentContentType =
    (typeof documentContentTypeEnum.enumValues)[number];

interface UserIdInterface {
    userId: string;
}

interface FilePayload {
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
