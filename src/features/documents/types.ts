import { fileUploadStatusEnum } from "@/db/schemas";

export type FileUploadStatus = typeof fileUploadStatusEnum.enumValues[number];
export enum SubjectsEnum{
    PHYSICS = "physics",
    CHEMISTRY = "chemistry",
    MATHEMATICS = "mathematics",
    ENGLISH = "english"
}