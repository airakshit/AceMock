import {
    documentFileTypeEnum,
    documentStatusEnum,
    documentFileStatusEnum,
    documentPageStatusEnum,
    documentContentTypeEnum,
} from "@/db/schemas";

export type DocumentStatus = (typeof documentStatusEnum.enumValues)[number];

export type DocumentFileType = (typeof documentFileTypeEnum.enumValues)[number];

export type DocumentFileStatus =
    (typeof documentFileStatusEnum.enumValues)[number];

export type DocumentPageStatus =
    (typeof documentPageStatusEnum.enumValues)[number];

export type DocumentContentType =
    (typeof documentContentTypeEnum.enumValues)[number];
