import {
  documentProcessingStatusEnum,
  filePageOCRStatusEnum,
  fileProcessingStatusEnum,
  fileUploadStatusEnum,
} from "@/db/schemas";

export type DocumentProcessingStatus =
  (typeof documentProcessingStatusEnum.enumValues)[number];
export type FileUploadStatus = (typeof fileUploadStatusEnum.enumValues)[number];
export type FileProcessingStatus =
  (typeof fileProcessingStatusEnum.enumValues)[number];
export type FilePageOCRStatus =
  (typeof filePageOCRStatusEnum.enumValues)[number];
export enum SubjectsEnum {
  PHYSICS = "physics",
  CHEMISTRY = "chemistry",
  MATHEMATICS = "mathematics",
  ENGLISH = "english",
}
