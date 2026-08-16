import {
    documentFileTypeEnum,
    documentStatusEnum,
    documentFileStatusEnum,
    documentPageStatusEnum,
    documentContentTypeEnum,
    documents,
    documentFiles,
} from "@/db/schemas";

export type DocumentStatusEnum = (typeof documentStatusEnum.enumValues)[number];
export type DocumentFileTypeEnum =
    (typeof documentFileTypeEnum.enumValues)[number];
export type DocumentFileStatusEnum =
    (typeof documentFileStatusEnum.enumValues)[number];
export type DocumentPageStatusEnum =
    (typeof documentPageStatusEnum.enumValues)[number];

export type DocumentContentTypeEnum =
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
    contentType: DocumentContentTypeEnum;
    pdfs: FilePayload[];
    images: FilePayload[];
}
export interface CreateNewDocumentActionResponse {
    document: typeof documents.$inferSelect;
    files: Array<typeof documentFiles.$inferSelect>;
}
