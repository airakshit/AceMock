import {
  documentProcessingStatusEnum,
  filePageOCRStatusEnum,
  fileProcessingStatusEnum,
  fileUploadStatusEnum,
  uploadSessionStatusEnum,
} from "@/db/schemas";
export type { FileRecoveryAction } from "./uploads/recovery-decision";

export type DocumentProcessingStatus =
  (typeof documentProcessingStatusEnum.enumValues)[number];

export type DocumentFilterProcessingStatus =
  | DocumentProcessingStatus
  | "processing";

export type FileUploadStatus = (typeof fileUploadStatusEnum.enumValues)[number];

export type FileProcessingStatus =
  (typeof fileProcessingStatusEnum.enumValues)[number];

export type FilePageOCRStatus =
  (typeof filePageOCRStatusEnum.enumValues)[number];

export type UploadSessionStatus =
  (typeof uploadSessionStatusEnum.enumValues)[number];

export enum SubjectsEnum {
  PHYSICS = "physics",
  CHEMISTRY = "chemistry",
  MATHEMATICS = "mathematics",
  ENGLISH = "english",
}
