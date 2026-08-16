import {
    documentFileTypeEnum,
    documentStatusEnum,
    documentFileStatusEnum,
    documentPageStatusEnum,
} from "@/db/schemas";

export type DocumentStatusEnum = (typeof documentStatusEnum.enumValues)[number];
export type DocumentFileTypeEnum =
    (typeof documentFileTypeEnum.enumValues)[number];
export type DocumentFileStatusEnum =
    (typeof documentFileStatusEnum.enumValues)[number];
export type DocumentPageStatusEnum =
    (typeof documentPageStatusEnum.enumValues)[number];

export enum FileContentTypeEnum {
    PHYSICS = "physics",
    CHEMISTRY = "chemistry",
    MATHS = "maths",
    ENGLISH = "english",
    MOCK_TEST = "mock-tests",
    STUDY_NOTES = "study-notes",
}

interface UserIdInterface {
    userId: string;
}

interface FilePayload {
    name: string;
    size: number;
    type: string;
}

export interface CreateNewDocumentPayload extends UserIdInterface {
    title: string;
    description?: string;
    pdfs: FilePayload[];
    images: FilePayload[];
}
